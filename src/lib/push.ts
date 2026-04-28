import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? ''
const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@efootballcup.app'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

/**
 * Send a push notification to one or more user IDs.
 * Silently skips users with no subscription or invalid endpoints.
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

  if (!subs || subs.length === 0) return

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icon-192.png',
  })

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        message
      ).catch(async (err) => {
        // 410 = subscription expired — remove it
        if (err.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      })
    )
  )
}
