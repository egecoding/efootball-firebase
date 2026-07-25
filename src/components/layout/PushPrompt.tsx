'use client'

import { useEffect } from 'react'

interface PushPromptProps {
  /** Only signed-in users get here — see the guard below. */
  enabled: boolean
}

// Silently auto-subscribes logged-in users to push notifications on app load.
// No banner shown — browser's native permission dialog fires automatically.
export function PushPrompt({ enabled }: PushPromptProps) {
  useEffect(() => {
    // Never prompt anonymous visitors: the subscribe endpoint rejects them with
    // 401 anyway, and an unsolicited permission dialog on a first visit is what
    // browsers punish with a permanent auto-block. Guests are handled separately
    // by GuestPushPrompt, which has a participant id to attach the subscription to.
    if (!enabled) return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'denied') return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready

        // If already subscribed, re-save to ensure it's in the DB
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(existing.toJSON()),
          })
          return
        }

        // Request permission — browser shows its native dialog
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        })
      } catch { /* silently ignore */ }
    }

    subscribe()
  }, [enabled])

  return null
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)))
}
