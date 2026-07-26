'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useScreenshotScore } from '@/hooks/useScreenshotScore'
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
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'error' | 'success' | 'warning'
    text: string
  } | null>(null)

  const p1Name = player1Profile?.display_name ?? player1Profile?.username ?? 'Player 1'
  const p2Name = player2Profile?.display_name ?? player2Profile?.username ?? 'Player 2'

  // Screenshot — read client-side with Tesseract.js (free, no external API).
  // A confident read prefills the score below; the player still reviews and submits it.
  const { uploadStatus, uploadFileName, screenshotPath, aiNotice, fileRef, handleFile, clear } = useScreenshotScore({
    matchId: match.id,
    participantId: null,
    currentUserId,
    player1Name: p1Name,
    player2Name: p2Name,
    onScoreDetected: (p1, p2) => {
      setP1Score(String(p1))
      setP2Score(String(p2))
    },
  })

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

      {/* Screenshot — optional, organizer sees it to confirm the result */}
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wider">
          📸 Match Screenshot <span className="normal-case font-normal text-gray-400">(optional)</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Upload a screenshot of the final score. AI will try to read it and prefill the score below — you always review and submit it yourself.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          className="hidden"
          id="result-screenshot-upload"
        />

        {uploadStatus === 'idle' && (
          <label
            htmlFor="result-screenshot-upload"
            className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors"
          >
            <ImagePlus className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Upload match screenshot</span>
          </label>
        )}
        {uploadStatus === 'uploading' && (
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
            <Spinner size="sm" />
            <span className="text-sm text-gray-500">Uploading {uploadFileName}…</span>
          </div>
        )}
        {uploadStatus === 'scanning' && (
          <div className="flex items-center gap-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-4 py-3">
            <Spinner size="sm" />
            <span className="text-sm text-purple-700 dark:text-purple-400">🤖 AI is scanning the screenshot for the score…</span>
          </div>
        )}
        {uploadStatus === 'done' && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="flex-1 text-sm text-green-700 dark:text-green-400 truncate">{uploadFileName}</span>
            <button type="button" onClick={clear} className="text-green-600 hover:text-red-500 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {uploadStatus === 'error' && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
            <span className="flex-1 text-sm text-red-700 dark:text-red-400">Upload failed — try again.</span>
            <button type="button" onClick={clear} className="text-red-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {aiNotice && (
          <div
            className={`mt-2 rounded-lg border px-4 py-3 text-sm ${
              aiNotice.type === 'low'
                ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                : 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
            }`}
          >
            {aiNotice.text}
          </div>
        )}
      </div>

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

      <Button
        type="submit"
        loading={loading}
        disabled={uploadStatus === 'uploading' || uploadStatus === 'scanning'}
        size="lg"
      >
        Submit Result
      </Button>
    </form>
  )
}
