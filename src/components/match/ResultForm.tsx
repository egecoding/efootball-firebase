'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScreenshotUpload } from './ScreenshotUpload'
import type { MatchWithPlayers, Profile } from '@/types/database'

interface ResultFormProps {
  match: MatchWithPlayers
  currentUserId: string
  player1Profile: Pick<Profile, 'id' | 'username' | 'display_name'> | null
  player2Profile: Pick<Profile, 'id' | 'username' | 'display_name'> | null
}

export function ResultForm({
  match,
  currentUserId,
  player1Profile,
  player2Profile,
}: ResultFormProps) {
  const router = useRouter()
  const [p1Score, setP1Score] = useState('')
  const [p2Score, setP2Score] = useState('')
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'error' | 'success' | 'warning'
    text: string
  } | null>(null)

  const p1Name = player1Profile?.display_name ?? player1Profile?.username ?? 'Player 1'
  const p2Name = player2Profile?.display_name ?? player2Profile?.username ?? 'Player 2'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setLoading(true)

    const s1 = parseInt(p1Score, 10)
    const s2 = parseInt(p2Score, 10)

    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setMessage({ type: 'error', text: 'Enter valid non-negative scores.' })
      setLoading(false)
      return
    }

    const res = await fetch(`/api/matches/${match.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player1_score: s1,
        player2_score: s2,
        screenshot_url: screenshotPath,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error })
      setLoading(false)
      return
    }

    if (data.status === 'awaiting_confirmation') {
      setMessage({
        type: 'success',
        text: 'Score submitted! Waiting for your opponent to confirm.',
      })
    } else if (data.status === 'disputed') {
      setMessage({ type: 'warning', text: data.message })
    } else if (data.status === 'completed') {
      setMessage({
        type: 'success',
        text: 'Match result confirmed! Redirecting…',
      })
      setTimeout(() => {
        router.push(`/tournaments/${match.tournament_id}`)
        router.refresh()
      }, 1500)
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 truncate">
            {p1Name}{' '}
            {currentUserId === match.player1_id && (
              <span className="text-brand-500">(you)</span>
            )}
          </p>
          <Input
            type="number"
            min="0"
            max="99"
            required
            value={p1Score}
            onChange={(e) => setP1Score(e.target.value)}
            placeholder="0"
            className="text-center text-2xl font-bold"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 truncate">
            {p2Name}{' '}
            {currentUserId === match.player2_id && (
              <span className="text-brand-500">(you)</span>
            )}
          </p>
          <Input
            type="number"
            min="0"
            max="99"
            required
            value={p2Score}
            onChange={(e) => setP2Score(e.target.value)}
            placeholder="0"
            className="text-center text-2xl font-bold"
          />
        </div>
      </div>

      <ScreenshotUpload
        matchId={match.id}
        userId={currentUserId}
        onUpload={setScreenshotPath}
      />

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm border ${
            message.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : message.type === 'warning'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <Button type="submit" loading={loading} size="lg">
        Submit Result
      </Button>
    </form>
  )
}
