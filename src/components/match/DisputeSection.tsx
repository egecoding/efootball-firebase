'use client'

import { useState, useEffect } from 'react'
import { DisputeButton } from './DisputeButton'

interface DisputeSectionProps {
  matchId: string
  tournamentId: string
  /** Server-resolved: the signed-in user is one of the two players. */
  isSignedInPlayer: boolean
  disputed: boolean
}

/**
 * Shows the dispute control to whoever is entitled to it.
 *
 * Guests have no session, so the server can't tell whether the visitor is in
 * this match — their identity lives in localStorage. This resolves it on the
 * client; the API still authorizes the request properly, so a guest who isn't
 * actually in the match gets a 403 rather than a silent success.
 */
export function DisputeSection({ matchId, tournamentId, isSignedInPlayer, disputed }: DisputeSectionProps) {
  const [guestParticipantId, setGuestParticipantId] = useState<string | null>(null)

  useEffect(() => {
    if (isSignedInPlayer) return
    setGuestParticipantId(localStorage.getItem(`participant_${tournamentId}`))
  }, [isSignedInPlayer, tournamentId])

  const canDispute = isSignedInPlayer || !!guestParticipantId
  if (!canDispute) return null

  if (disputed) {
    return (
      <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-4 py-3 text-sm text-orange-700 dark:text-orange-400 text-center mb-6">
        Dispute submitted — the organizer has been notified and can correct the result.
      </div>
    )
  }

  return (
    <div className="flex justify-center mb-6">
      <DisputeButton
        matchId={matchId}
        participantId={isSignedInPlayer ? null : guestParticipantId}
      />
    </div>
  )
}
