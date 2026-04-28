'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Suspense } from 'react'

interface Match {
  id: string
  match_number: number
  player1_name: string | null
  player2_name: string | null
  status: string
  tournament_title: string | null
}

function SharePage() {
  const params = useSearchParams()
  const router = useRouter()
  const key = params.get('key')
  const error = params.get('error')

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedMatch, setSelectedMatch] = useState<string>('')
  const [p1Score, setP1Score] = useState('')
  const [p2Score, setP2Score] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Load signed URL for the temp image
  useEffect(() => {
    if (!key) return
    fetch(`/api/share-target/image?key=${key}`)
      .then((r) => r.json())
      .then((d) => { if (d.url) setImageUrl(d.url) })
      .catch(() => {})
  }, [key])

  // Load the user's active matches (scheduled or awaiting confirmation)
  useEffect(() => {
    fetch('/api/matches/active')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setMatches(d) })
      .catch(() => {})
  }, [])

  const submit = useCallback(async () => {
    if (!selectedMatch || !key) return
    setSubmitting(true)
    setSubmitError('')

    try {
      // 1. Associate the temp image with the selected match
      const assocRes = await fetch(`/api/share-target/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, matchId: selectedMatch }),
      })
      if (!assocRes.ok) throw new Error('Failed to assign screenshot')

      // 2. Submit scores if provided
      if (p1Score !== '' && p2Score !== '') {
        const scoreRes = await fetch(`/api/matches/${selectedMatch}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player1_score: Number(p1Score),
            player2_score: Number(p2Score),
          }),
        })
        if (!scoreRes.ok) {
          const d = await scoreRes.json()
          throw new Error(d.error ?? 'Failed to submit scores')
        }
      }

      setDone(true)
      setTimeout(() => router.push(`/matches/${selectedMatch}`), 1500)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [selectedMatch, key, p1Score, p2Score, router])

  if (error) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Share failed</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {error === 'nofile' ? 'No image was received.' : 'Upload failed. Try again.'}
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Screenshot submitted!</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Taking you to your match…</p>
      </div>
    )
  }

  return (
    <div className="page-container max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Upload className="h-5 w-5 text-brand-500" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Submit Screenshot</h1>
      </div>

      {/* Preview */}
      {imageUrl ? (
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Shared screenshot" className="w-full object-contain max-h-64" />
        </div>
      ) : key ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 h-48 flex items-center justify-center mb-6">
          <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
        </div>
      ) : null}

      {/* Match selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Which match is this?
        </label>
        {matches.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No active matches found. Play a match first.</p>
        ) : (
          <select
            value={selectedMatch}
            onChange={(e) => setSelectedMatch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a match…</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                Match #{m.match_number} — {m.player1_name ?? '?'} vs {m.player2_name ?? '?'}
                {m.tournament_title ? ` (${m.tournament_title})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Optional score entry */}
      {selectedMatch && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Score (optional)</p>
          <div className="flex items-center gap-3">
            <input
              type="number" min={0} max={99}
              value={p1Score}
              onChange={(e) => setP1Score(e.target.value)}
              placeholder="0"
              className="w-20 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-center text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-gray-400 font-bold">–</span>
            <input
              type="number" min={0} max={99}
              value={p2Score}
              onChange={(e) => setP2Score(e.target.value)}
              placeholder="0"
              className="w-20 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-center text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{submitError}</p>
      )}

      <button
        onClick={submit}
        disabled={!selectedMatch || submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white transition-colors"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {submitting ? 'Submitting…' : 'Submit Screenshot'}
      </button>
    </div>
  )
}

export default function SharePageWrapper() {
  return (
    <Suspense>
      <SharePage />
    </Suspense>
  )
}
