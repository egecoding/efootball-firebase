import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToAll, type PushPayload } from '@/lib/push'
import webpush from 'web-push'

// POST /api/push/broadcast
// Body: { title, body, url?, tournamentId? }
// If tournamentId is provided, notifies ALL participants (registered + guests).
// Otherwise notifies ALL push subscribers globally.
export async function POST(req: Request) {
  const admin_user = await requireSuperAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, body, url, tournamentId } = await req.json()
  if (!title || !body) return NextResponse.json({ error: 'title and body are required' }, { status: 400 })

  const payload: PushPayload = { title, body, url: url ?? '/' }
  const db = createAdminClient()

  if (tournamentId) {
    // Get all participants in this tournament (both registered and guest)
    const { data: participants } = await db
      .from('participants')
      .select('id, user_id')
      .eq('tournament_id', tournamentId)

    if (!participants || participants.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No participants found' })
    }

    const userIds = participants.filter((p) => p.user_id).map((p) => p.user_id as string)
    const participantIds = participants.filter((p) => !p.user_id).map((p) => p.id as string)

    // Fetch subscriptions for both user-based and participant-based
    const filters: string[] = []
    let query = db.from('push_subscriptions').select('endpoint, p256dh, auth_key')

    if (userIds.length > 0 && participantIds.length > 0) {
      query = query.or(`user_id.in.(${userIds.join(',')}),participant_id.in.(${participantIds.join(',')})`)
    } else if (userIds.length > 0) {
      query = query.in('user_id', userIds)
    } else {
      query = query.in('participant_id', participantIds)
    }

    const { data: subs } = await query
    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No push subscribers among participants' })
    }

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      icon: '/icon-192.png',
    })

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? ''
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? ''
    const rawEmail = process.env.VAPID_EMAIL ?? 'admin@efootballcup.app'
    const vapidEmail = rawEmail.startsWith('mailto:') ? rawEmail : `mailto:${rawEmail}`
    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
    }

    await Promise.allSettled(
      subs.map((sub) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
            message
          )
          .catch(async (err) => {
            if (err.statusCode === 410) {
              await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            }
          })
      )
    )

    return NextResponse.json({ sent: subs.length })
  }

  // Global broadcast — all subscribers (users + guests)
  await sendPushToAll(payload)

  const { count } = await db
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({ sent: count ?? 0 })
}
