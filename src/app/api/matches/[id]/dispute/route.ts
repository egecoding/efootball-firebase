import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendPush } from '@/lib/push'

// POST /api/matches/[id]/dispute
// Authenticated player: flag a match result as disputed with a reason.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { reason } = body
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'A reason is required to dispute a result' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, player1_id, player2_id, status, tournament_id')
    .eq('id', params.id)
    .single()

  if (matchErr || !match) {
    return NextResponse.json({ error: matchErr?.message ?? 'Match not found' }, { status: 404 })
  }

  if (match.player1_id !== user.id && match.player2_id !== user.id) {
    return NextResponse.json({ error: 'Only match participants can dispute a result' }, { status: 403 })
  }

  if (match.status !== 'awaiting_confirmation') {
    return NextResponse.json({ error: 'Only matches awaiting confirmation can be disputed' }, { status: 409 })
  }

  const { error: updateErr } = await admin
    .from('matches')
    .update({ disputed: true, dispute_reason: reason.trim() })
    .eq('id', params.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Notify organizer
  const { data: tournament } = await admin
    .from('tournaments')
    .select('organizer_id')
    .eq('id', match.tournament_id)
    .single()

  if (tournament?.organizer_id) {
    sendPush([tournament.organizer_id], {
      title: '⚠️ Match disputed',
      body: `A player has flagged a match result for review: "${reason.trim().slice(0, 80)}"`,
      url: `/tournaments/${match.tournament_id}/manage`,
    })
  }

  return NextResponse.json({ status: 'disputed' })
}
