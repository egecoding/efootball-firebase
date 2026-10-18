'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Pencil, Lock } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ParticipantWithProfile, Profile } from '@/types/database'
import Link from 'next/link'

interface ParticipantListProps {
  participants: ParticipantWithProfile[]
  organizerId: string
  currentUserId?: string
  tournamentId: string
  // Participant ids that have already played a match (completed/awaiting_confirmation/walkover)
  // and can therefore no longer be edited or removed.
  lockedParticipantIds?: Set<string>
}

export function ParticipantList({
  participants,
  organizerId,
  currentUserId,
  tournamentId,
  lockedParticipantIds,
}: ParticipantListProps) {
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  async function removeParticipant(p: ParticipantWithProfile) {
    setRemoving(p.id)
    if (p.user_id) {
      await fetch(`/api/tournaments/${tournamentId}/participants?userId=${p.user_id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/tournaments/${tournamentId}/participants?participantId=${p.id}`, { method: 'DELETE' })
    }
    setRemoving(null)
    router.refresh()
  }

  function startEditing(p: ParticipantWithProfile) {
    setEditingId(p.id)
    setEditError('')
    setEditValue(p.profiles?.display_name ?? p.profiles?.username ?? p.name ?? '')
  }

  async function saveEdit(p: ParticipantWithProfile) {
    const name = editValue.trim()
    if (!name) { setEditError('Name is required'); return }
    setSaving(true)
    setEditError('')
    const res = await fetch(`/api/tournaments/${tournamentId}/participants`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: p.id, name }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setEditError(data.error ?? 'Failed to update participant')
      return
    }
    setEditingId(null)
    router.refresh()
  }

  if (participants.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">No participants yet.</p>
    )
  }

  const isOrganizer = currentUserId === organizerId

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {participants.map((p) => {
        const profile = p.profiles
        const displayName = profile?.display_name ?? profile?.username ?? p.name ?? 'Unknown'
        const isGuest = !p.user_id
        const canRemove = isOrganizer || currentUserId === p.user_id
        const isLocked = lockedParticipantIds?.has(p.id) ?? false
        const canEdit = isOrganizer && !isLocked
        const isEditing = editingId === p.id

        if (isEditing) {
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-brand-300 dark:border-brand-700 bg-white dark:bg-gray-900 px-4 py-3"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <Input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(p) } }}
                  placeholder="Player name or tag…"
                  className="text-sm"
                />
                {editError && <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>}
              </div>
              <Button variant="secondary" size="sm" loading={saving} onClick={() => saveEdit(p)}>
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setEditingId(null)}
                className="text-gray-400"
              >
                Cancel
              </Button>
            </div>
          )
        }

        return (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3"
          >
            {p.seed != null && (
              <span className="text-xs font-mono text-gray-400 w-5">#{p.seed}</span>
            )}
            <Avatar src={profile?.avatar_url} name={displayName} size="sm" />
            {isGuest ? (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-400">Guest</p>
              </div>
            ) : (
              <Link href={`/profile/${p.user_id}`} className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate hover:text-brand-500">
                  {displayName}
                </p>
                <p className="text-xs text-gray-400">
                  {(profile as Profile)?.wins ?? 0}W {(profile as Profile)?.losses ?? 0}L
                </p>
              </Link>
            )}
            {isLocked && isOrganizer && (
              <span title="Already played — locked" className="text-gray-300 dark:text-gray-600">
                <Lock className="h-3.5 w-3.5" />
              </span>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing(p)}
                className="text-gray-400 hover:text-brand-500 p-1"
                aria-label="Edit participant"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canRemove && !isLocked && (
              <Button
                variant="ghost"
                size="sm"
                loading={removing === p.id}
                onClick={() => removeParticipant(p)}
                className="text-gray-400 hover:text-red-500 p-1"
                aria-label="Remove participant"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
