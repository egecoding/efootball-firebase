'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Play, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { InviteModal } from './InviteModal'
import { ParticipantList } from './ParticipantList'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import type { TournamentWithOrganizer, ParticipantWithProfile } from '@/types/database'

interface UserResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface ManagePanelProps {
  tournament: TournamentWithOrganizer
  participants: ParticipantWithProfile[]
}

export function ManagePanel({ tournament, participants: initialParticipants }: ManagePanelProps) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [startLoading, setStartLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState('')

  // Participant search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addError, setAddError] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFull = initialParticipants.length >= tournament.max_participants

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/users?q=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        const data: UserResult[] = await res.json()
        // Filter out already-added participants
        const existingIds = new Set(initialParticipants.map((p) => p.user_id))
        setSearchResults(data.filter((u) => !existingIds.has(u.id)))
      }
      setSearching(false)
    }, 300)
  }, [searchQuery, initialParticipants])

  async function addParticipant(u: UserResult) {
    setAddError('')
    setAddingId(u.id)
    const res = await fetch(`/api/tournaments/${tournament.id}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id }),
    })
    setAddingId(null)
    if (!res.ok) {
      const { error: msg } = await res.json()
      setAddError(msg)
      return
    }
    setSearchQuery('')
    setSearchResults([])
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
          {initialParticipants.length} / {tournament.max_participants} participants
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
            disabled={initialParticipants.length < 2}
            className="justify-start gap-3"
          >
            <Play className="h-4 w-4" />
            Start Tournament
            {initialParticipants.length < 2 && (
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

      {/* Add Participant (open tournaments only) */}
      {tournament.status === 'open' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Add Participant</h2>
            {isFull && (
              <span className="ml-auto text-xs text-gray-400">Tournament is full</span>
            )}
          </div>

          <div className="relative">
            <Input
              placeholder="Search by username…"
              value={searchQuery}
              onChange={(e) => {
                setAddError('')
                setSearchQuery(e.target.value)
              }}
              disabled={isFull}
            />
            {(searchResults.length > 0 || searching || (searchQuery.length >= 2 && !searching)) && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
                {searching && (
                  <div className="px-4 py-2 text-sm text-gray-400">Searching…</div>
                )}
                {!searching && searchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={addingId === u.id}
                    onClick={() => addParticipant(u)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-medium text-brand-700 dark:text-brand-300 shrink-0">
                      {(u.display_name ?? u.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {u.display_name ?? u.username}
                      </p>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                    </div>
                    {addingId === u.id && (
                      <span className="ml-auto text-xs text-gray-400">Adding…</span>
                    )}
                  </button>
                ))}
                {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                  <div className="px-4 py-2 text-sm text-gray-400">No users found</div>
                )}
              </div>
            )}
          </div>

          {addError && (
            <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>
          )}
        </div>
      )}

      {/* Participants */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
          Participants ({initialParticipants.length})
        </h2>
        <ParticipantList
          participants={initialParticipants}
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
      />
    </div>
  )
}
