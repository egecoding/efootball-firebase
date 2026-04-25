'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Play, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InviteModal } from './InviteModal'
import { ParticipantList } from './ParticipantList'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import type { TournamentWithOrganizer, ParticipantWithProfile } from '@/types/database'

interface ManagePanelProps {
  tournament: TournamentWithOrganizer
  participants: ParticipantWithProfile[]
  baseUrl: string
}

export function ManagePanel({ tournament, participants, baseUrl }: ManagePanelProps) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [startLoading, setStartLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState('')

  const [playerInput, setPlayerInput] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
