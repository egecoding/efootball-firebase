import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkSuperAdmin } from '@/lib/admin-guard'
import { finalizeMatch } from '@/lib/match-finalize'

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
    .select('id, status, player1_score, player2_score, tournament_id')
    .eq('id', params.id)
    .single()

  if (matchErr || !match) {
    return NextResponse.json({ error: matchErr?.message ?? 'Match not found' }, { status: 404 })
  }

  const { data: tournament, error: tournamentErr } = await admin
    .from('tournaments')
    .select('organizer_id')
    .eq('id', match.tournament_id)
    .single()

  if (tournamentErr || !tournament) {
    return NextResponse.json({ error: tournamentErr?.message ?? 'Tournament not found' }, { status: 404 })
  }

  const superAdmin = await checkSuperAdmin(user.id)
  if (tournament.organizer_id !== user.id && !superAdmin) {
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
    if (!Number.isInteger(player1_score) || !Number.isInteger(player2_score)) {
      return NextResponse.json({ error: 'player1_score and player2_score must be whole numbers' }, { status: 400 })
    }
    if (player1_score < 0 || player2_score < 0) {
      return NextResponse.json({ error: 'Scores must be non-negative' }, { status: 400 })
    }
    if (player1_score > 99 || player2_score > 99) {
      return NextResponse.json({ error: 'Scores must be 99 or less' }, { status: 400 })
    }
    p1Score = player1_score
    p2Score = player2_score
  } else {
    // awaiting_confirmation — use scores from the match row if present,
    // otherwise fall back to result_submissions (registered players store scores
    // there only on first submission; the match row is not updated until confirmed)
    if (match.player1_score !== null && match.player2_score !== null) {
      p1Score = match.player1_score as number
      p2Score = match.player2_score as number
    } else {
      const { data: submission } = await admin
        .from('result_submissions')
        .select('player1_score, player2_score')
        .eq('match_id', params.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!submission || submission.player1_score === null || submission.player2_score === null) {
        return NextResponse.json({ error: 'No scores submitted yet' }, { status: 409 })
      }
      p1Score = submission.player1_score as number
      p2Score = submission.player2_score as number
    }
  }

  const result = await finalizeMatch(admin, params.id, {
    player1Score: p1Score,
    player2Score: p2Score,
    submittedBy: user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ status: 'completed', winner_id: result.winnerId })
}
