import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? ''
const rawEmail = process.env.VAPID_EMAIL ?? 'admin@efootballcup.app'
const vapidEmail = rawEmail.startsWith('mailto:') ? rawEmail : `mailto:${rawEmail}`

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

async function dispatchToSubs(
  subs: { endpoint: string; p256dh: string; auth_key: string }[],
  payload: PushPayload,
  admin: ReturnType<typeof createAdminClient>
) {
  if (!subs || subs.length === 0) return
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icon-192.png',
  })
  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          message
        )
        .catch(async (err) => {
          if (err.statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        })
    )
  )
}

/**
 * Send push notification to registered (logged-in) users by user ID.
 */
export async function sendPush(userIds: (string | null | undefined)[], payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey) return
  const ids = userIds.filter((id): id is string => !!id)
  if (ids.length === 0) return

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .in('user_id', ids)

  await dispatchToSubs(subs ?? [], payload, admin)
}

/**
 * Send push notification to guest players by participant ID.
 */
export async function sendPushToParticipants(
  participantIds: (string | null | undefined)[],
  payload: PushPayload
) {
  if (!vapidPublicKey || !vapidPrivateKey) return
  const ids = participantIds.filter((id): id is string => !!id)
  if (ids.length === 0) return

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .in('participant_id', ids)

  await dispatchToSubs(subs ?? [], payload, admin)
}

/**
 * Send push to everyone — both user-based and participant-based subscriptions.
 * Used for global broadcast from admin panel.
 */
export async function sendPushToAll(payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey) return
  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')

  await dispatchToSubs(subs ?? [], payload, admin)
}
