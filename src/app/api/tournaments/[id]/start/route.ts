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

  // Fetch participants (include name for guests)
  const { data: participants } = await supabase
    .from('participants')
    .select('id, user_id, name')
    .eq('tournament_id', params.id)

  if (!participants || participants.length < 2) {
    return NextResponse.json(
      { error: 'Need at least 2 participants to start' },
      { status: 409 }
    )
  }

  const bracketParticipants = participants.map((p) => ({
    id: p.user_id ?? null,
    name: p.name ?? null,
    participantId: p.id,
  }))

  const matches = generateBracket(bracketParticipants)
  const totalRounds = Math.max(...matches.map((m) => m.roundNumber))

  // Insert rounds
  const roundsPayload = Array.from(new Set(matches.map((m) => m.roundNumber)))
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
    player1_name: m.player1Name,
    player2_id: m.player2Id,
    player2_name: m.player2Name,
    next_match_slot: m.nextMatchSlot,
    status: determineStatus(
      m.player1Id !== null || m.player1Name !== null,
      m.player2Id !== null || m.player2Name !== null
    ),
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
    const hasP1 = match.player1_id !== null || (match as { player1_name?: string | null }).player1_name !== null
    const hasP2 = match.player2_id !== null || (match as { player1_name?: string | null; player2_name?: string | null }).player2_name !== null

    const hasBye = (hasP1 && !hasP2) || (!hasP1 && hasP2)

    if (hasBye) {
      const winner_id = hasP1 ? match.player1_id : match.player2_id
      const winner_name = hasP1
        ? (match as { player1_name?: string | null }).player1_name
        : (match as { player2_name?: string | null }).player2_name

      await supabase
        .from('matches')
        .update({ winner_id, status: 'walkover' })
        .eq('id', match.id)

      if (match.next_match_id && match.next_match_slot) {
        const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
        const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'
        await supabase
          .from('matches')
          .update({ [idField]: winner_id, [nameField]: winner_name, status: 'scheduled' })
          .eq('id', match.next_match_id)
      }
    }
  }

  // Update tournament status and assign seeds
  await supabase
    .from('tournaments')
    .update({ status: 'in_progress' })
    .eq('id', params.id)

  for (let i = 0; i < bracketParticipants.length; i++) {
    await supabase
      .from('participants')
      .update({ seed: i + 1 })
      .eq('id', bracketParticipants[i].participantId)
  }

  return NextResponse.json({
    success: true,
    rounds: insertedRounds.length,
    matches: insertedMatches.length,
  })
}

function determineStatus(
  hasP1: boolean,
  hasP2: boolean
): 'pending' | 'scheduled' | 'walkover' {
  if (!hasP1 && !hasP2) return 'pending'
  if (!hasP1 || !hasP2) return 'walkover'
  return 'scheduled'
}
