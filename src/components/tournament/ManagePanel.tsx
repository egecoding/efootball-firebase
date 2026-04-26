'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Play, Trash2, UserPlus, ExternalLink, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { InviteModal } from './InviteModal'
import { ParticipantList } from './ParticipantList'
import { TournamentStatusBadge, MatchStatusBadge } from '@/components/ui/Badge'
import type { TournamentWithOrganizer, ParticipantWithProfile } from '@/types/database'
import type { ManageMatch } from '@/app/tournaments/[id]/manage/page'

interface ManagePanelProps {
  tournament: TournamentWithOrganizer
  participants: ParticipantWithProfile[]
  matches: ManageMatch[]
  baseUrl: string
}

export function ManagePanel({ tournament, participants, matches, baseUrl }: ManagePanelProps) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [startLoading, setStartLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState('')

  const [playerInput, setPlayerInput] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Per-match confirm state
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmErrors, setConfirmErrors] = useState<Record<string, string>>({})

  const isFull = participants.length >= tournament.max_participants

  async function addPlayer() {
    const name = playerInput.trim()
    if (!name) return
    setAddError('')
    setAdding(true)
    const res = await fetch(`/api/tournaments/${tournament.id}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setAdding(false)
    if (!res.ok) {
      const { error: msg } = await res.json()
      setAddError(msg)
      return
    }
    setPlayerInput('')
    inputRef.current?.focus()
    router.refresh()
  }

  async function startTournament() {
    setError('')
    setStartLoading(true)
    const res = await fetch(`/api/tournaments/${tournament.id}/start`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setStartLoading(false)
      return
    }
    router.push(`/tournaments/${tournament.id}`)
    router.refresh()
  }

  async function deleteTournament() {
    if (!confirm('Delete this tournament? This cannot be undone.')) return
    setDeleteLoading(true)
    await fetch(`/api/tournaments/${tournament.id}`, { method: 'DELETE' })
    router.push('/dashboard')
    router.refresh()
  }

  async function confirmResult(matchId: string) {
    setConfirmingId(matchId)
    setConfirmErrors((prev) => ({ ...prev, [matchId]: '' }))
    const res = await fetch(`/api/matches/${matchId}/confirm`, { method: 'POST' })
    const data = await res.json()
    setConfirmingId(null)
    if (!res.ok) {
      setConfirmErrors((prev) => ({ ...prev, [matchId]: data.error }))
      return
    }
    router.refresh()
  }

  const activeMatches = matches.filter((m) => m.status !== 'scheduled' || m.player1_id || m.player2_id)

  return (
    <div className="flex flex-col gap-6">
      {/* Status */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Status</h2>
          <TournamentStatusBadge status={tournament.status} />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {participants.length} / {tournament.max_participants} participants
        </p>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Actions</h2>

        <Button
          variant="secondary"
          onClick={() => setInviteOpen(true)}
          className="justify-start gap-3"
        >
          <Share2 className="h-4 w-4" />
          Share Invite Link
        </Button>

        {tournament.status === 'open' && (
          <Button
            onClick={startTournament}
            loading={startLoading}
            disabled={participants.length < 2}
            className="justify-start gap-3"
          >
            <Play className="h-4 w-4" />
            Start Tournament
            {participants.length < 2 && (
              <span className="text-xs opacity-70 ml-auto">(need ≥2 players)</span>
            )}
          </Button>
        )}

        <Button
          variant="danger"
          onClick={deleteTournament}
          loading={deleteLoading}
          className="justify-start gap-3"
        >
          <Trash2 className="h-4 w-4" />
          Delete Tournament
        </Button>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Add Player (open tournaments only) */}
      {tournament.status === 'open' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Add Player</h2>
            {isFull && (
              <span className="ml-auto text-xs text-gray-400">Tournament is full</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={playerInput}
              onChange={(e) => { setAddError(''); setPlayerInput(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }}
              placeholder="Player name or tag…"
              disabled={isFull || adding}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addPlayer}
              loading={adding}
              disabled={isFull}
            >
              Add
            </Button>
          </div>
          {addError && (
            <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>
          )}
        </div>
      )}

      {/* Match Results (in-progress / completed tournaments) */}
      {tournament.status !== 'open' && activeMatches.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Match Results</h2>
          <div className="flex flex-col gap-3">
            {activeMatches.map((m) => {
              const p1 = m.player1_name ?? 'TBD'
              const p2 = m.player2_name ?? 'TBD'
              const scoreText =
                m.player1_score !== null && m.player2_score !== null
                  ? `${m.player1_score} – ${m.player2_score}`
                  : null
              const isConfirming = confirmingId === m.id
              const confirmError = confirmErrors[m.id]

              return (
                <div
                  key={m.id}
                  className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {m.round_name && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{m.round_name}</p>
                      )}
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {p1} vs {p2}
                        {scoreText && (
                          <span className="ml-2 font-bold text-brand-500">{scoreText}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <MatchStatusBadge status={m.status as 'pending' | 'scheduled' | 'awaiting_confirmation' | 'completed' | 'walkover'} />
                      <Link
                        href={`/matches/${m.id}`}
                        className="text-gray-400 hover:text-brand-500 transition-colors"
                        title="View match"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Finalized screenshot */}
                  {m.screenshotSignedUrl && (
                    <a href={m.screenshotSignedUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={m.screenshotSignedUrl}
                        alt="Match screenshot"
                        className="w-full rounded border border-gray-200 dark:border-gray-700 object-contain max-h-40"
                      />
                    </a>
                  )}

                  {/* Submission screenshot — player submitted, organizer confirms inline */}
                  {m.submissionScreenshotSignedUrl && (
                    <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3">
                      <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                        Screenshot submitted{m.submittedByName ? ` by ${m.submittedByName}` : ''} — pending your confirmation
                      </p>
                      <a href={m.submissionScreenshotSignedUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={m.submissionScreenshotSignedUrl}
                          alt="Submitted screenshot"
                          className="w-full rounded border border-yellow-200 dark:border-yellow-700 object-contain max-h-48 mb-3"
                        />
                      </a>
                      {scoreText && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3 font-medium">
                          Submitted score: {scoreText}
                        </p>
                      )}
                      {confirmError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mb-2">{confirmError}</p>
                      )}
                      <button
                        onClick={() => confirmResult(m.id)}
                        disabled={isConfirming}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {isConfirming ? 'Confirming…' : 'Confirm Result'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Participants */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
          Participants ({participants.length})
        </h2>
        <ParticipantList
          participants={participants}
          organizerId={tournament.organizer_id}
          currentUserId={tournament.organizer_id}
          tournamentId={tournament.id}
        />
      </div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        inviteCode={tournament.invite_code}
        tournamentId={tournament.id}
        tournamentTitle={tournament.title}
        baseUrl={baseUrl}
      />
    </div>
  )
}
