'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { normalizeInviteCode } from '@/lib/utils/invite'
import { getClient } from '@/lib/supabase/client'

interface PageProps {
  params: { id: string }
  searchParams: { code?: string }
}

export default function JoinTournamentPage({ params, searchParams }: PageProps) {
  const router = useRouter()
  const [code, setCode] = useState(searchParams.code ?? '')
  const [nametag, setNametag] = useState('')
  const [isGuest, setIsGuest] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [personalLink, setPersonalLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await getClient().auth.getUser()
      setIsGuest(!user)

      // If guest already joined this tournament, go straight to their portal
      if (!user) {
        const existing = localStorage.getItem(`participant_${params.id}`)
        if (existing) {
          router.replace(`/tournaments/${params.id}/portal`)
        }
      }
    })()
  }, [params.id, router])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const body: Record<string, string> = { invite_code: normalizeInviteCode(code) }
    if (isGuest) body.name = nametag

    const res = await fetch(`/api/tournaments/${params.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }

    // Store participant_id so the portal can identify this player (guest or registered)
    if (data.participant_id) {
      localStorage.setItem(`participant_${params.id}`, data.participant_id)
      if (isGuest) {
        // Build a personal link guests can bookmark to return later
        const link = `${window.location.origin}/tournaments/${params.id}/portal?pid=${data.participant_id}`
        setPersonalLink(link)
      }
    }

    setSuccess(true)
    const portalUrl = isGuest
      ? `/tournaments/${params.id}/portal?newjoin=1`
      : `/tournaments/${params.id}/portal`
    setTimeout(() => router.push(portalUrl), 2200)
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
      <div className="fixed inset-0 dot-grid text-gray-400/10 dark:text-white/[0.025] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {success ? (
          <div className="text-center animate-bounce-in">
            <div className="inline-flex items-center justify-center mb-6">
              <svg viewBox="0 0 80 80" className="h-24 w-24" fill="none">
                <circle cx="40" cy="40" r="36" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" className="animate-draw-circle" />
                <polyline points="22,40 34,52 58,28" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-check" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You&apos;re in!</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Taking you to the tournament…</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none p-8">
            <div className="text-center mb-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 mb-4">
                <span className="text-2xl">🏆</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Join Tournament</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isGuest
                  ? 'Enter the invite code and your nametag to join.'
                  : 'Enter the invite code to join this tournament.'}
              </p>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <Input
                label="Invite Code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                className="text-center text-lg tracking-widest font-mono"
              />
              {isGuest && (
                <Input
                  label="Your Nametag"
                  required
                  value={nametag}
                  onChange={(e) => setNametag(e.target.value)}
                  placeholder="e.g. PhilEFC"
                />
              )}
              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} size="lg" className="mt-1">
                Join Tournament
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
