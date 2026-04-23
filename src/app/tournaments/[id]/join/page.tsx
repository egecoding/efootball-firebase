'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Trophy } from 'lucide-react'
import { normalizeInviteCode } from '@/lib/utils/invite'

interface PageProps {
  params: { id: string }
  searchParams: { code?: string }
}

export default function JoinTournamentPage({ params, searchParams }: PageProps) {
  const router = useRouter()
  const [code, setCode] = useState(searchParams.code ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch(`/api/tournaments/${params.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: normalizeInviteCode(code) }),
    })

    const data = await res.json()

    if (!res.ok) {
      if (res.status === 401) {
        router.push(`/auth/login?redirectTo=/tournaments/${params.id}/join?code=${code}`)
        return
      }
      setError(data.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push(`/tournaments/${params.id}`), 1500)
  }

  return (
    <div className="page-container">
      <div className="max-w-sm mx-auto text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 mb-6">
          <Trophy className="h-7 w-7 text-brand-500" />
        </div>
        <h1 className="section-title mb-2">Join Tournament</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Enter the invite code to join this tournament.
        </p>

        {success ? (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-6 py-5 text-green-700 dark:text-green-400 font-medium">
            Joined! Redirecting…
          </div>
        ) : (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <Input
              label="Invite Code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              className="text-center text-lg tracking-widest font-mono"
            />
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} size="lg">
              Join Tournament
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
