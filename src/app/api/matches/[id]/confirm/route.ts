import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/matches/[id]/confirm
// Organizer-only: finalizes a match.
// - If match is awaiting_confirmation: uses already-submitted scores (body ignored).
// - If match is scheduled: requires player1_score and player2_score in body (manual entry).
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, status, next_match_id, next_match_slot, tournament_id, screenshot_url')
    .eq('id', params.id)
    .single()

  if (matchErr || !match) {
    return NextResponse.json({ error: matchErr?.message ?? 'Match not found' }, { status: 404 })
  }

  const { data: tournament, error: tournamentErr } = await admin
    .from('tournaments')
    .select('organizer_id, format')
    .eq('id', match.tournament_id)
    .single()

  if (tournamentErr || !tournament) {
    return NextResponse.json({ error: tournamentErr?.message ?? 'Tournament not found' }, { status: 404 })
  }

  if (tournament.organizer_id !== user.id) {
    return NextResponse.json({ error: 'Only the organizer can confirm results' }, { status: 403 })
  }

  if (!['scheduled', 'awaiting_confirmation'].includes(match.status)) {
    return NextResponse.json({ error: 'Match cannot be confirmed in its current state' }, { status: 409 })
  }

  let p1Score: number
  let p2Score: number

  if (match.status === 'scheduled') {
    // Organizer is manually entering scores — require them in the request body
    const body = await req.json().catch(() => ({}))
    const { player1_score, player2_score } = body
    if (typeof player1_score !== 'number' || typeof player2_score !== 'number') {
      return NextResponse.json({ error: 'player1_score and player2_score are required' }, { status: 400 })
    }
    if (player1_score < 0 || player2_score < 0) {
      return NextResponse.json({ error: 'Scores must be non-negative' }, { status: 400 })
    }
    p1Score = player1_score
    p2Score = player2_score
  } else {
    // awaiting_confirmation — use the scores already stored on the match
    if (match.player1_score === null || match.player2_score === null) {
      return NextResponse.json({ error: 'No scores submitted yet' }, { status: 409 })
    }
    p1Score = match.player1_score as number
    p2Score = match.player2_score as number
  }

  if (p1Score === p2Score && tournament.format === 'knockout') {
    return NextResponse.json({ error: 'Cannot confirm a draw in a knockout tournament' }, { status: 400 })
  }

  const isDraw = p1Score === p2Score
  const winner_id = isDraw ? null : p1Score > p2Score ? match.player1_id : match.player2_id
  const loser_id = isDraw ? null : p1Score > p2Score ? match.player2_id : match.player1_id

  await admin
    .from('matches')
    .update({
      player1_score: p1Score,
      player2_score: p2Score,
      winner_id,
      status: 'completed',
      submitted_by: user.id,
      played_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (winner_id) await admin.rpc('increment_wins', { uid: winner_id })
  if (loser_id) await admin.rpc('increment_losses', { uid: loser_id })

  if (match.next_match_id && match.next_match_slot) {
    const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
    const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'
    const winnerName = p1Score > p2Score ? match.player1_name : match.player2_name
    await admin
      .from('matches')
      .update({ [idField]: winner_id ?? null, [nameField]: winnerName ?? null, status: 'scheduled' })
      .eq('id', match.next_match_id)
  } else if (!match.next_match_id) {
    // Knockout: no next match means this was the final — done immediately.
    // League / round-robin: every match has no next_match_id, so only mark
    // complete once there are zero non-completed matches left.
    let allDone = true
    if (tournament.format !== 'knockout') {
      const { data: remaining } = await admin
        .from('matches')
        .select('id')
        .eq('tournament_id', match.tournament_id)
        .neq('status', 'completed')
        .limit(1)
      allDone = !remaining || remaining.length === 0
    }
    if (allDone) {
      await admin
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', match.tournament_id)
    }
  }

  return NextResponse.json({ status: 'completed', winner_id })
}
