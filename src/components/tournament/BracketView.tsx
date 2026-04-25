'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import { MatchStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import type { RoundWithMatches, MatchWithPlayers, Profile } from '@/types/database'

interface BracketViewProps {
  rounds: RoundWithMatches[]
  currentUserId?: string
  organizerId?: string
  profileMap?: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
}

export function BracketView({ rounds, currentUserId, organizerId, profileMap = {} }: BracketViewProps) {
  if (!rounds || rounds.length === 0) return null

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max" style={{ alignItems: 'flex-start' }}>
        {rounds.map((round, idx) => (
          <RoundColumn
            key={round.id}
            round={round}
            totalRounds={rounds.length}
            isFinal={idx === rounds.length - 1}
            currentUserId={currentUserId}
            organizerId={organizerId}
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
  isFinal,
  currentUserId,
  organizerId,
  profileMap,
}: {
  round: RoundWithMatches
  totalRounds: number
  isFinal: boolean
  currentUserId?: string
  organizerId?: string
  profileMap: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
}) {
  const sortedMatches = [...(round.matches ?? [])].sort(
    (a, b) => a.match_number - b.match_number
  )

  const BASE_GAP = 8
  const gap = Math.pow(2, round.round_number - 1) * BASE_GAP

  return (
    <div className="flex flex-col" style={{ gap: `${gap}px`, minWidth: '220px' }}>
      <div className={`text-xs font-semibold uppercase tracking-wider mb-2 text-center ${
        isFinal ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'
      }`}>
        {isFinal && <span className="mr-1">🏆</span>}
        {round.round_name}
      </div>
      {sortedMatches.map((match) => (
        <MatchCard
          key={match.id}
          match={match as unknown as MatchWithPlayers}
          currentUserId={currentUserId}
          organizerId={organizerId}
          isFinal={isFinal}
          profileMap={profileMap}
        />
      ))}
    </div>
  )
}

function MatchCard({
  match,
  currentUserId,
  organizerId,
  isFinal,
  profileMap,
}: {
  match: MatchWithPlayers
  currentUserId?: string
  organizerId?: string
  isFinal: boolean
  profileMap: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
}) {
  const isActivePlayer =
    currentUserId &&
    (match.player1_id === currentUserId || match.player2_id === currentUserId)
  const isOrganizer = !!organizerId && currentUserId === organizerId
  const isSubmittable =
    (isActivePlayer || isOrganizer) &&
    (match.status === 'scheduled' || match.status === 'awaiting_confirmation')

  const p1Profile = match.player1_id ? profileMap[match.player1_id] : null
  const p2Profile = match.player2_id ? profileMap[match.player2_id] : null
  const m = match as typeof match & { player1_name?: string | null; player2_name?: string | null }
  const p1Name = p1Profile ? (p1Profile.display_name ?? p1Profile.username) : (m.player1_name ?? null)
  const p2Name = p2Profile ? (p2Profile.display_name ?? p2Profile.username) : (m.player2_name ?? null)

  const card = (
    <div
      className={`rounded-lg border bg-white dark:bg-gray-900 overflow-hidden shadow-sm transition-all ${
        isFinal
          ? 'border-yellow-400/60 dark:border-yellow-500/40 shadow-yellow-500/10 shadow-md'
          : 'border-gray-200 dark:border-gray-800'
      } ${isSubmittable ? 'animate-pulse-ring cursor-pointer hover:border-brand-400 dark:hover:border-brand-600' : ''}`}
    >
      <PlayerSlot
        profile={p1Profile}
        name={p1Name}
        score={match.player1_score}
        isWinner={!!match.winner_id && match.winner_id === match.player1_id}
        isCompleted={match.status === 'completed' || match.status === 'walkover'}
        isCurrentUser={currentUserId === match.player1_id}
        showCrown={isFinal && !!match.winner_id && match.winner_id === match.player1_id}
      />
      <div className="h-px bg-gray-100 dark:bg-gray-800" />
      <PlayerSlot
        profile={p2Profile}
        name={p2Name}
        score={match.player2_score}
        isWinner={!!match.winner_id && match.winner_id === match.player2_id}
        isCompleted={match.status === 'completed' || match.status === 'walkover'}
        isCurrentUser={currentUserId === match.player2_id}
        showCrown={isFinal && !!match.winner_id && match.winner_id === match.player2_id}
      />

      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800">
        <MatchStatusBadge status={match.status} />
        {isSubmittable && (
          <span className="text-xs text-brand-500 font-semibold">Submit →</span>
        )}
      </div>
    </div>
  )

  if (isSubmittable) {
    return <Link href={`/matches/${match.id}`}>{card}</Link>
  }
  return card
}

function PlayerSlot({
  profile,
  name: nameProp,
  score,
  isWinner,
  isCompleted,
  isCurrentUser,
  showCrown,
}: {
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
  name: string | null
  score: number | null
  isWinner: boolean
  isCompleted: boolean
  isCurrentUser: boolean
  showCrown: boolean
}) {
  const name = nameProp

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 transition-colors ${
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
      {showCrown && (
        <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0 fill-yellow-400" />
      )}
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
