'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

export function PushPrompt() {
  const [show, setShow] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    // Only show for logged-in users (check for a session cookie hint)
    // We defer to Notification API availability
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission !== 'default') return
    // Don't show if dismissed in last 3 days
    const dismissed = localStorage.getItem('push_prompt_dismissed')
    if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 60 * 60 * 1000) return
    // Show after 8 seconds
    const t = setTimeout(() => setShow(true), 8000)
    return () => clearTimeout(t)
  }, [])

  async function enable() {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { dismiss(); return }

    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      setSubscribed(true)
      setTimeout(() => setShow(false), 2000)
    } catch {
      dismiss()
    }
  }

  function dismiss() {
    localStorage.setItem('push_prompt_dismissed', String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 animate-slide-up">
      <div className="relative rounded-2xl border border-brand-400/30 bg-gray-950/95 backdrop-blur-md shadow-2xl shadow-black/60 p-4 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />

        <button onClick={dismiss} className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
            <Bell className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-0.5">
              {subscribed ? '✅ Notifications on!' : 'Stay in the game'}
            </p>
            <p className="text-xs text-gray-400 leading-snug">
              {subscribed
                ? "We'll notify you when your match is ready."
                : "Get notified when your match is confirmed or it's your turn to play."}
            </p>
          </div>
        </div>

        {!subscribed && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={enable}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-all"
            >
              <Bell className="h-3.5 w-3.5" />
              Enable
            </button>
            <button onClick={dismiss} className="rounded-xl px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)))
}
