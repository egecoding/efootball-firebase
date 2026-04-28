import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/push/subscribe
// Saves a Web Push subscription.
// - Logged-in users: authenticated via session, saved with user_id.
// - Guests: pass participantId in body, saved with participant_id (no auth required).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Try authenticated user first
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { error } = await admin.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        participant_id: null,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth_key: body.keys.auth,
      },
      { onConflict: 'endpoint' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Guest: requires participantId
  const participantId = body.participantId
  if (!participantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the participant exists
  const { data: participant, error: pErr } = await admin
    .from('participants')
    .select('id')
    .eq('id', participantId)
    .single()

  if (pErr || !participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
  }

  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: null,
      participant_id: participantId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth_key: body.keys.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE /api/push/subscribe — unsubscribe by endpoint
export async function DELETE(req: Request) {
  const { endpoint } = await req.json().catch(() => ({}))
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return NextResponse.json({ success: true })
}
