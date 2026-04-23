import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateBracket, getRoundName } from '@/lib/utils/bracket'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify organizer
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('organizer_id, status')
    .eq('id', params.id)
    .single()

  if (!tournament || tournament.organizer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (tournament.status !== 'open') {
    return NextResponse.json(
      { error: 'Tournament must be in "open" status to start' },
      { status: 409 }
    )
  }

  // Fetch participants
  const { data: participants } = await supabase
    .from('participants')
    .select('user_id')
    .eq('tournament_id', params.id)

  if (!participants || participants.length < 2) {
    return NextResponse.json(
      { error: 'Need at least 2 participants to start' },
      { status: 409 }
    )
  }

  const participantIds = participants.map((p) => p.user_id)
  const matches = generateBracket(participantIds)
  const totalRounds = Math.max(...matches.map((m) => m.roundNumber))

  // Insert rounds
  const roundsPayload = Array.from(
    new Set(matches.map((m) => m.roundNumber))
  )
    .sort((a, b) => a - b)
    .map((rn) => ({
      tournament_id: params.id,
      round_number: rn,
      round_name: getRoundName(rn, totalRounds),
    }))

  const { data: insertedRounds, error: roundsError } = await supabase
    .from('rounds')
    .insert(roundsPayload)
    .select()

  if (roundsError) {
    return NextResponse.json({ error: roundsError.message }, { status: 500 })
  }

  const roundMap = new Map(insertedRounds.map((r) => [r.round_number, r.id]))

  // Insert matches without next_match_id first
  const matchesPayload = matches.map((m) => ({
    tournament_id: params.id,
    round_id: roundMap.get(m.roundNumber)!,
    match_number: m.matchNumber,
    player1_id: m.player1Id,
    player2_id: m.player2Id,
    next_match_slot: m.nextMatchSlot,
    status: determineStatus(m.player1Id, m.player2Id),
  }))

  const { data: insertedMatches, error: matchesError } = await supabase
    .from('matches')
    .insert(matchesPayload)
    .select()

  if (matchesError) {
    return NextResponse.json({ error: matchesError.message }, { status: 500 })
  }

  // Map matchNumber → DB id
  const matchNumberToId = new Map(
    insertedMatches.map((m) => [m.match_number, m.id])
  )

  // Wire next_match_id
  for (const m of matches) {
    if (m.nextMatchNumber !== null) {
      await supabase
        .from('matches')
        .update({ next_match_id: matchNumberToId.get(m.nextMatchNumber) })
        .eq('id', matchNumberToId.get(m.matchNumber)!)
    }
  }

  // Handle byes: auto-advance players vs null opponents
  for (const match of insertedMatches) {
    const hasBye =
      (match.player1_id && !match.player2_id) ||
      (!match.player1_id && match.player2_id)

    if (hasBye) {
      const winner_id = match.player1_id ?? match.player2_id
      await supabase
        .from('matches')
        .update({ winner_id, status: 'walkover' })
        .eq('id', match.id)

      if (match.next_match_id && match.next_match_slot) {
        const field =
          match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
        await supabase
          .from('matches')
          .update({ [field]: winner_id, status: 'scheduled' })
          .eq('id', match.next_match_id)
      }
    }
  }

  // Update tournament status and assign seeds
  await supabase
    .from('tournaments')
    .update({ status: 'in_progress' })
    .eq('id', params.id)

  for (let i = 0; i < participantIds.length; i++) {
    await supabase
      .from('participants')
      .update({ seed: i + 1 })
      .match({ tournament_id: params.id, user_id: participantIds[i] })
  }

  return NextResponse.json({
    success: true,
    rounds: insertedRounds.length,
    matches: insertedMatches.length,
  })
}

function determineStatus(
  p1: string | null,
  p2: string | null
): 'pending' | 'scheduled' | 'walkover' {
  if (!p1 && !p2) return 'pending'
  if (!p1 || !p2) return 'walkover'
  return 'scheduled'
}
