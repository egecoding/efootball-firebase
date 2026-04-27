'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, ImagePlus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'

interface GuestResultFormProps {
  matchId: string
  tournamentId: string
  player1Name: string | null
  player2Name: string | null
  status: string
}

/**
 * Shown on the match page for guests who joined via invite link.
 * Reads the participant ID from localStorage, verifies the guest is in
 * this match, then lets them submit scores + screenshot via the API routes
 * (which use the admin client and accept X-Participant-Id header).
 */
export function GuestResultForm({
  matchId,
  tournamentId,
  player1Name,
  player2Name,
  status,
}: GuestResultFormProps) {
  const router = useRouter()
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Score
  const [p1Score, setP1Score] = useState('')
  const [p2Score, setP2Score] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Screenshot
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadFileName, setUploadFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const pid = localStorage.getItem(`participant_${tournamentId}`)
    if (!pid) return
    setParticipantId(pid)
    setReady(true)
  }, [tournamentId])

  // Don't render if no guest identity found in localStorage
  if (!ready || !participantId) return null

  // Only show for matches that have this guest as a named player
  // (server already knows player names; we show the form and let the API validate)
  const isLikelyInMatch =
    (player1Name !== null && player1Name !== '') ||
    (player2Name !== null && player2Name !== '')
  if (!isLikelyInMatch) return null

  if (status === 'awaiting_confirmation') {
    return (
      <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400 mt-6 text-center">
        Score submitted — waiting for the organizer to confirm.
      </div>
    )
  }

  if (status !== 'scheduled') return null

  async function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('uploading')
    setUploadFileName(file.name)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch(`/api/matches/${matchId}/screenshot`, {
      method: 'POST',
      headers: { 'X-Participant-Id': participantId! },
      body: form,
    })

    if (!res.ok) {
      setUploadStatus('error')
      return
    }
    const { path } = await res.json()
    setUploadStatus('done')
    setScreenshotPath(path)
  }

  function clearScreenshot() {
    setUploadStatus('idle')
    setUploadFileName('')
    setScreenshotPath(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const s1 = parseInt(p1Score, 10)
    const s2 = parseInt(p2Score, 10)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setMessage({ type: 'error', text: 'Enter valid non-negative scores.' })
      return
    }

    setSubmitting(true)
    const res = await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Participant-Id': participantId!,
      },
      body: JSON.stringify({ player1_score: s1, player2_score: s2, screenshot_url: screenshotPath }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error ?? 'Submission failed.' })
      return
    }

    setMessage({ type: 'success', text: 'Score submitted! The organizer will review and confirm the result.' })
    router.refresh()
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        Submit Your Result
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Score inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 truncate">
              {player1Name ?? 'Player 1'}
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
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 truncate">
              {player2Name ?? 'Player 2'}
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

        {/* Screenshot upload */}
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wider">
            Match Screenshot{' '}
            <span className="normal-case font-normal text-gray-400">(optional but recommended)</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Upload a screenshot so the organizer can verify the result.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleScreenshot}
            className="hidden"
            id="guest-screenshot-upload"
          />

          {uploadStatus === 'idle' && (
            <label
              htmlFor="guest-screenshot-upload"
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
          {uploadStatus === 'done' && (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="flex-1 text-sm text-green-700 dark:text-green-400 truncate">{uploadFileName}</span>
              <button type="button" onClick={clearScreenshot} className="text-green-600 hover:text-red-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {uploadStatus === 'error' && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <span className="flex-1 text-sm text-red-700 dark:text-red-400">Upload failed — try again.</span>
              <button type="button" onClick={clearScreenshot} className="text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm border ${
              message.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <Button type="submit" loading={submitting} disabled={uploadStatus === 'uploading'} size="lg">
          <Upload className="h-4 w-4" />
          Submit Result
        </Button>
      </form>
    </div>
  )
}
