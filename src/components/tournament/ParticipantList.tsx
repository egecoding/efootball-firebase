'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import type { ParticipantWithProfile, Profile } from '@/types/database'
import Link from 'next/link'

interface ParticipantListProps {
  participants: ParticipantWithProfile[]
  organizerId: string
  currentUserId?: string
  tournamentId: string
}

export function ParticipantList({
  participants,
  organizerId,
  currentUserId,
  tournamentId,
}: ParticipantListProps) {
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)

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
            {canRemove && (
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
