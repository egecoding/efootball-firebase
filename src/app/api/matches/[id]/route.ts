import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, tournament_id, round_id, match_number, player1_id, player2_id, player1_score, player2_score, winner_id, status, screenshot_url, submitted_by, next_match_id, next_match_slot, played_at, created_at, updated_at'
    )
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { player1_score, player2_score, screenshot_url } = body

  if (typeof player1_score !== 'number' || typeof player2_score !== 'number') {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 })
  }
  if (player1_score < 0 || player2_score < 0) {
    return NextResponse.json({ error: 'Scores must be non-negative' }, { status: 400 })
  }
  if (player1_score === player2_score) {
    return NextResponse.json({ error: 'Draws are not allowed in single elimination' }, { status: 400 })
  }

  // Fetch match
  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, player1_id, player1_name, player2_id, player2_name, status, next_match_id, next_match_slot, tournament_id'
    )
    .eq('id', params.id)
    .single()

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const isPlayer =
    match.player1_id === user.id || match.player2_id === user.id

  // Allow organizer to also submit
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('organizer_id')
    .eq('id', match.tournament_id)
    .single()

  const isOrganizer = tournament?.organizer_id === user.id

  if (!isPlayer && !isOrganizer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!['scheduled', 'awaiting_confirmation'].includes(match.status)) {
    return NextResponse.json(
      { error: 'Match is not in a submittable state' },
      { status: 409 }
    )
  }

  // If organizer directly submits, bypass two-player flow
  if (isOrganizer && !isPlayer) {
    return finalizeMatch(supabase, match, player1_score, player2_score, screenshot_url, user.id)
  }

  // Upsert player submission
  const { error: subError } = await supabase
    .from('result_submissions')
    .upsert(
      {
        match_id: params.id,
        submitted_by: user.id,
        player1_score,
        player2_score,
        screenshot_url: screenshot_url ?? null,
      },
      { onConflict: 'match_id,submitted_by' }
    )

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  // Fetch all submissions for this match
  const { data: submissions } = await supabase
    .from('result_submissions')
    .select('submitted_by, player1_score, player2_score')
    .eq('match_id', params.id)

  const otherPlayerId =
    match.player1_id === user.id ? match.player2_id : match.player1_id
  const otherSubmission = submissions?.find(
    (s) => s.submitted_by === otherPlayerId
  )

  if (!otherSubmission) {
    // First submission only — mark awaiting
    await supabase
      .from('matches')
      .update({ status: 'awaiting_confirmation' })
      .eq('id', params.id)
    return NextResponse.json({ status: 'awaiting_confirmation' })
  }

  // Both submitted — check agreement
  const allAgree = submissions!.every(
    (s) =>
      s.player1_score === submissions![0].player1_score &&
      s.player2_score === submissions![0].player2_score
  )

  if (!allAgree) {
    return NextResponse.json({
      status: 'disputed',
      message:
        'Score submissions do not match. Contact the organizer to resolve.',
    })
  }

  // Finalize with agreed scores
  return finalizeMatch(
    supabase,
    match,
    submissions![0].player1_score,
    submissions![0].player2_score,
    screenshot_url,
    user.id
  )
}

async function finalizeMatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  match: {
    id: string
    player1_id: string | null
    player1_name?: string | null
    player2_id: string | null
    player2_name?: string | null
    next_match_id: string | null
    next_match_slot: number | null
    tournament_id: string
  },
  player1_score: number,
  player2_score: number,
  screenshot_url: string | null,
  submittedBy: string
) {
  const winner_id =
    player1_score > player2_score ? match.player1_id : match.player2_id
  const loser_id =
    player1_score > player2_score ? match.player2_id : match.player1_id

  await supabase
    .from('matches')
    .update({
      player1_score,
      player2_score,
      winner_id,
      status: 'completed',
      screenshot_url: screenshot_url ?? null,
      submitted_by: submittedBy,
      played_at: new Date().toISOString(),
    })
    .eq('id', match.id)

  // Atomic win/loss increment
  if (winner_id) {
    await supabase.rpc('increment_wins', { uid: winner_id })
  }
  if (loser_id) {
    await supabase.rpc('increment_losses', { uid: loser_id })
  }

  // Advance winner to next match (handle guest players too)
  if (match.next_match_id && match.next_match_slot) {
    const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
    const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'
    const winnerName = player1_score > player2_score ? match.player1_name : match.player2_name
    await supabase
      .from('matches')
      .update({ [idField]: winner_id ?? null, [nameField]: winnerName ?? null, status: 'scheduled' })
      .eq('id', match.next_match_id)
  } else if (!match.next_match_id) {
    // No next match = this was the final
    await supabase
      .from('tournaments')
      .update({ status: 'completed' })
      .eq('id', match.tournament_id)
  }

  return NextResponse.json({ status: 'completed', winner_id })
}
