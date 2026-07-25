'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

interface DisputeButtonProps {
  matchId: string
  /** Guest participants have no session — identifies them to the API instead. */
  participantId?: string | null
}

export function DisputeButton({ matchId, participantId }: DisputeButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-4 py-3 text-sm text-orange-700 dark:text-orange-400 text-center">
        Dispute submitted — the organizer has been notified.
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Dispute result
      </button>
    )
  }

  async function handleSubmit() {
    if (!reason.trim()) { setError('Please enter a reason.'); return }
    setSubmitting(true)
    setError('')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (participantId) headers['X-Participant-Id'] = participantId

    const res = await fetch(`/api/matches/${matchId}/dispute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Failed to submit dispute.'); return }
    setDone(true)
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
        <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Dispute this result</p>
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Describe the issue (e.g. wrong score entered, screenshot mismatch…)"
        className="w-full rounded-lg border border-orange-200 dark:border-orange-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Dispute'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
