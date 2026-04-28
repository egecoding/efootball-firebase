'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share } from 'lucide-react'

type Platform = 'android' | 'ios' | null

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [platform, setPlatform] = useState<Platform>(null)
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Don't show if already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if dismissed recently (24h cooldown)
    const dismissedAt = localStorage.getItem('pwa_prompt_dismissed')
    if (dismissedAt && Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000) return

    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as Record<string, unknown>).MSStream
    const isAndroidChrome = /Android/.test(ua) && /Chrome/.test(ua)

    if (isIOS) {
      // iOS Safari: no beforeinstallprompt, show manual instructions after 3s
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)
      if (isSafari) {
        setTimeout(() => setPlatform('ios'), 3000)
      }
      return
    }

    // Android/Chrome: wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDeferredPrompt(e as any)
      setPlatform('android')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa_prompt_dismissed', String(Date.now()))
    setDismissed(true)
  }

  async function install() {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDismissed(true)
    } else {
      dismiss()
    }
    setDeferredPrompt(null)
    setInstalling(false)
  }

  if (dismissed || !platform) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 animate-slide-up">
      <div className="relative rounded-2xl border border-yellow-400/30 bg-gray-950/95 backdrop-blur-md shadow-2xl shadow-black/60 p-4 overflow-hidden">
        {/* Gold top accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />

        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          {/* Icon */}
          <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-2xl shadow-lg">
            ⚽
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-white mb-0.5">Install eFootball Cup</p>
            <p className="text-xs text-gray-400 leading-snug">
              {platform === 'android'
                ? 'Add to your home screen for quick access to your tournaments.'
                : 'Tap the Share button below, then "Add to Home Screen".'}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {platform === 'android' ? (
            <button
              onClick={install}
              disabled={installing}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400 disabled:opacity-60 transition-all"
            >
              <Download className="h-4 w-4" />
              {installing ? 'Installing…' : 'Install App'}
            </button>
          ) : (
            <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-gray-300">
              <Share className="h-4 w-4 shrink-0 text-blue-400" />
              <span>Tap <strong className="text-white">Share</strong> → <strong className="text-white">Add to Home Screen</strong></span>
            </div>
          )}
          <button
            onClick={dismiss}
            className="rounded-xl px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
