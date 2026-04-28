'use client'

import { useEffect } from 'react'

interface Props {
  tournamentId: string
}

// Silently auto-subscribes guest players to push notifications on portal load.
// No banner shown — browser's native permission dialog fires automatically.
export function GuestPushPrompt({ tournamentId }: Props) {
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'denied') return

    const participantId = localStorage.getItem(`participant_${tournamentId}`)
    if (!participantId) return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready

        // If already subscribed, just make sure it's saved server-side
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...existing.toJSON(), participantId }),
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
          body: JSON.stringify({ ...sub.toJSON(), participantId }),
        })
      } catch { /* silently ignore — e.g. SW not yet active */ }
    }

    subscribe()
  }, [tournamentId])

  return null
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)))
}
