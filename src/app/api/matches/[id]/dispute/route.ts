import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendPush } from '@/lib/push'
import { authorizeMatchActor } from '@/lib/match-auth'

// Results can be contested while awaiting confirmation *and* after they're
// finalized — a high-confidence AI screenshot read finalizes immediately, so
// completed is often the first state a player ever sees.
const DISPUTABLE_STATUSES = ['awaiting_confirmation', 'completed', 'walkover']

// POST /api/matches/[id]/dispute
// Match participant (registered user or guest): flag a result as disputed with a reason.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await req.json().catch(() => ({}))
  const { reason } = body
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'A reason is required to dispute a result' }, { status: 400 })
  }

  const admin = createAdminClient()

  const auth = await authorizeMatchActor(
    admin,
    params.id,
    user,
    req.headers.get('X-Participant-Id')
  )
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const match = auth.match

  // Only the two players may contest a result — the organizer resolves them instead.
  if (!auth.actor.isPlayer) {
    return NextResponse.json({ error: 'Only match participants can dispute a result' }, { status: 403 })
  }

  if (!DISPUTABLE_STATUSES.includes(match.status)) {
    return NextResponse.json({ error: 'This match has no result to dispute yet' }, { status: 409 })
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
