'use client'

import Link from 'next/link'
import { MatchStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import type { RoundWithMatches, MatchWithPlayers, Profile } from '@/types/database'

interface BracketViewProps {
  rounds: RoundWithMatches[]
  currentUserId?: string
  profileMap?: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
}

export function BracketView({ rounds, currentUserId, profileMap = {} }: BracketViewProps) {
  if (!rounds || rounds.length === 0) return null

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max" style={{ alignItems: 'flex-start' }}>
        {rounds.map((round) => (
          <RoundColumn
            key={round.id}
            round={round}
            totalRounds={rounds.length}
            currentUserId={currentUserId}
            profileMap={profileMap}
          />
        ))}
      </div>
    </div>
  )
}

function RoundColumn({
  round,
  totalRounds,
  currentUserId,
  profileMap,
}: {
  round: RoundWithMatches
  totalRounds: number
  currentUserId?: string
  profileMap: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
}) {
  const sortedMatches = [...(round.matches ?? [])].sort(
    (a, b) => a.match_number - b.match_number
  )

  const BASE_GAP = 8
  const gap = Math.pow(2, round.round_number - 1) * BASE_GAP

  return (
    <div className="flex flex-col" style={{ gap: `${gap}px`, minWidth: '220px' }}>
      <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 text-center">
        {round.round_name}
      </div>
      {sortedMatches.map((match) => (
        <MatchCard
          key={match.id}
          match={match as unknown as MatchWithPlayers}
          currentUserId={currentUserId}
          isFinal={round.round_number === totalRounds}
          profileMap={profileMap}
        />
      ))}
    </div>
  )
}

function MatchCard({
  match,
  currentUserId,
  isFinal,
  profileMap,
}: {
  match: MatchWithPlayers
  currentUserId?: string
  isFinal: boolean
  profileMap: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
}) {
  const isActivePlayer =
    currentUserId &&
    (match.player1_id === currentUserId || match.player2_id === currentUserId)
  const isSubmittable =
    isActivePlayer &&
    (match.status === 'scheduled' || match.status === 'awaiting_confirmation')

  const p1Profile = match.player1_id ? profileMap[match.player1_id] : null
  const p2Profile = match.player2_id ? profileMap[match.player2_id] : null
  // Guest players have no profile — fall back to player1_name/player2_name stored on the match
  const m = match as typeof match & { player1_name?: string | null; player2_name?: string | null }
  const p1Name = p1Profile ? (p1Profile.display_name ?? p1Profile.username) : (m.player1_name ?? null)
  const p2Name = p2Profile ? (p2Profile.display_name ?? p2Profile.username) : (m.player2_name ?? null)

  return (
    <div
      className={`rounded-lg border bg-white dark:bg-gray-900 overflow-hidden shadow-sm transition-all ${
        isFinal
          ? 'border-brand-400/50 dark:border-brand-500/50'
          : 'border-gray-200 dark:border-gray-800'
      } ${isSubmittable ? 'ring-2 ring-brand-500/50' : ''}`}
    >
      <PlayerSlot
        profile={p1Profile}
        name={p1Name}
        score={match.player1_score}
        isWinner={!!match.winner_id && match.winner_id === match.player1_id}
        isCompleted={match.status === 'completed' || match.status === 'walkover'}
        isCurrentUser={currentUserId === match.player1_id}
      />
      <div className="h-px bg-gray-100 dark:bg-gray-800" />
      <PlayerSlot
        profile={p2Profile}
        name={p2Name}
        score={match.player2_score}
        isWinner={!!match.winner_id && match.winner_id === match.player2_id}
        isCompleted={match.status === 'completed' || match.status === 'walkover'}
        isCurrentUser={currentUserId === match.player2_id}
      />

      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800">
        <MatchStatusBadge status={match.status} />
        {isSubmittable && (
          <Link
            href={`/matches/${match.id}`}
            className="text-xs text-brand-500 hover:text-brand-600 font-medium"
          >
            Submit →
          </Link>
        )}
      </div>
    </div>
  )
}

function PlayerSlot({
  profile,
  name: nameProp,
  score,
  isWinner,
  isCompleted,
  isCurrentUser,
}: {
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
  name: string | null
  score: number | null
  isWinner: boolean
  isCompleted: boolean
  isCurrentUser: boolean
}) {
  const name = nameProp

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${
        isWinner
          ? 'bg-brand-50 dark:bg-brand-900/20'
          : isCompleted && !isWinner && name
          ? 'opacity-50'
          : ''
      }`}
    >
      <Avatar src={profile?.avatar_url} name={name ?? undefined} size="sm" />
      <span
        className={`flex-1 text-xs truncate ${
          name
            ? isCurrentUser
              ? 'font-semibold text-brand-600 dark:text-brand-400'
              : 'font-medium text-gray-800 dark:text-gray-200'
            : 'text-gray-400 dark:text-gray-600 italic'
        }`}
      >
        {name ?? 'TBD'}
      </span>
      {score !== null && (
        <span
          className={`text-sm font-bold tabular-nums ${
            isWinner
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {score}
        </span>
      )}
    </div>
  )
}
