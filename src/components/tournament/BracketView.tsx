'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import type { RoundWithMatches, MatchWithPlayers, Profile } from '@/types/database'

/** Height of each match card slot. All maths keys off this. */
const SLOT = 96   // px — actual card height ≈ 88px, slot adds 8px breathing room
const CARD_W = 214 // px
const CONN_W = 44  // px — width of the SVG connector strip between columns

interface BracketViewProps {
  rounds: RoundWithMatches[]
  currentUserId?: string
  organizerId?: string
  profileMap?: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
}

export function BracketView({ rounds, currentUserId, organizerId, profileMap = {} }: BracketViewProps) {
  if (!rounds || rounds.length === 0) return null

  const sorted = [...rounds].sort((a, b) => a.round_number - b.round_number)
  const totalRounds = sorted.length

  // All columns have the same total height = SLOT * 2^(totalRounds-1)
  const bracketH = SLOT * Math.pow(2, totalRounds - 1)

  return (
    <div className="overflow-x-auto pb-4 -mx-1 px-1">
      {/* Round labels row */}
      <div className="flex mb-2" style={{ minWidth: 'max-content' }}>
        {sorted.map((round, idx) => {
          const isFinal = idx === totalRounds - 1
          return (
            <div key={round.id} className="flex items-center">
              <div
                style={{ width: CARD_W }}
                className={`text-center text-xs font-bold uppercase tracking-widest py-1 ${
                  isFinal
                    ? 'text-yellow-500 dark:text-yellow-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {isFinal ? '🏆 ' : ''}{round.round_name}
              </div>
              {idx < totalRounds - 1 && <div style={{ width: CONN_W }} />}
            </div>
          )
        })}
      </div>

      {/* Bracket body */}
      <div className="flex" style={{ height: bracketH, minWidth: 'max-content', alignItems: 'flex-start' }}>
        {sorted.map((round, idx) => {
          const isFinal = idx === totalRounds - 1
          const slotH = SLOT * Math.pow(2, idx)           // slot height for this round
          const matches = [...(round.matches ?? [])].sort((a, b) => a.match_number - b.match_number)

          // Connector geometry
          const nextSlotH = SLOT * Math.pow(2, idx + 1)   // slot height for next round

          return (
            <div key={round.id} className="flex items-start shrink-0">
              {/* ── Round column ── */}
              <div
                style={{ width: CARD_W, height: bracketH }}
                className="flex flex-col"
              >
                {matches.map((match, mi) => (
                  <div
                    key={match.id}
                    style={{ height: slotH, minHeight: slotH }}
                    className="flex items-center"
                  >
                    <MatchCard
                      match={match as unknown as MatchWithPlayers}
                      currentUserId={currentUserId}
                      organizerId={organizerId}
                      isFinal={isFinal}
                      profileMap={profileMap}
                      matchIndex={mi}
                      totalInRound={matches.length}
                    />
                  </div>
                ))}
              </div>

              {/* ── SVG connector ── */}
              {!isFinal && (
                <svg
                  width={CONN_W}
                  height={bracketH}
                  className="shrink-0"
                  style={{ overflow: 'visible' }}
                >
                  {Array.from({ length: Math.floor(matches.length / 2) }, (_, j) => {
                    const y1 = (2 * j) * slotH + slotH / 2
                    const y2 = (2 * j + 1) * slotH + slotH / 2
                    const yMid = (2 * j + 1) * slotH   // == j * nextSlotH + nextSlotH/2
                    const mx = CONN_W / 2
                    return (
                      <g key={j} stroke="currentColor" strokeWidth={1.5} fill="none" className="text-gray-300 dark:text-gray-600">
                        {/* exit from top match */}
                        <polyline points={`0,${y1} ${mx},${y1} ${mx},${yMid} ${CONN_W},${yMid}`} />
                        {/* exit from bottom match */}
                        <polyline points={`0,${y2} ${mx},${y2} ${mx},${yMid}`} />
                      </g>
                    )
                  })}
                  {/* bye pass-through if odd count */}
                  {matches.length % 2 === 1 && (() => {
                    const j = matches.length - 1
                    const y = j * slotH + slotH / 2
                    return (
                      <line key="bye" x1={0} y1={y} x2={CONN_W} y2={y}
                        stroke="currentColor" strokeWidth={1.5}
                        className="text-gray-300 dark:text-gray-600" />
                    )
                  })()}
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MatchCard({
  match,
  currentUserId,
  organizerId,
  isFinal,
  profileMap,
  matchIndex,
  totalInRound,
}: {
  match: MatchWithPlayers
  currentUserId?: string
  organizerId?: string
  isFinal: boolean
  profileMap: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
  matchIndex: number
  totalInRound: number
}) {
  const m = match as typeof match & { player1_name?: string | null; player2_name?: string | null }
  const p1Profile = match.player1_id ? profileMap[match.player1_id] : null
  const p2Profile = match.player2_id ? profileMap[match.player2_id] : null
  const p1Name = p1Profile ? (p1Profile.display_name ?? p1Profile.username) : (m.player1_name ?? null)
  const p2Name = p2Profile ? (p2Profile.display_name ?? p2Profile.username) : (m.player2_name ?? null)

  const isMyMatch = currentUserId && (match.player1_id === currentUserId || match.player2_id === currentUserId)
  const isOrg = !!organizerId && currentUserId === organizerId
  const canSubmit = (isMyMatch || isOrg) && (match.status === 'scheduled' || match.status === 'awaiting_confirmation')
  const isCompleted = match.status === 'completed' || match.status === 'walkover'

  const borderClass = isFinal
    ? 'border-yellow-400/70 dark:border-yellow-500/50 shadow-md shadow-yellow-500/10'
    : canSubmit
    ? 'border-brand-400 dark:border-brand-500 shadow-sm shadow-brand-500/20'
    : 'border-gray-200 dark:border-gray-700/80'

  const card = (
    <div
      className={`w-full rounded-lg border bg-white dark:bg-gray-900 overflow-hidden transition-all ${borderClass} ${
        canSubmit ? 'hover:border-brand-500 dark:hover:border-brand-400 cursor-pointer' : ''
      }`}
    >
      {/* Player 1 */}
      <PlayerRow
        name={p1Name}
        score={match.player1_score}
        isWinner={isCompleted && match.winner_id === match.player1_id}
        isLoser={isCompleted && !!match.winner_id && match.winner_id !== match.player1_id}
        isMe={currentUserId === match.player1_id}
        showCrown={isFinal && isCompleted && match.winner_id === match.player1_id}
      />
      <div className="h-px bg-gray-100 dark:bg-gray-800" />
      {/* Player 2 */}
      <PlayerRow
        name={p2Name}
        score={match.player2_score}
        isWinner={isCompleted && match.winner_id === match.player2_id}
        isLoser={isCompleted && !!match.winner_id && match.winner_id !== match.player2_id}
        isMe={currentUserId === match.player2_id}
        showCrown={isFinal && isCompleted && match.winner_id === match.player2_id}
      />
      {/* Footer */}
      <div className={`flex items-center justify-between px-2.5 py-1 border-t ${
        isFinal
          ? 'border-yellow-400/30 dark:border-yellow-600/20 bg-yellow-50/50 dark:bg-yellow-900/10'
          : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40'
      }`}>
        <StatusPip status={match.status} />
        {canSubmit && (
          <span className="text-[10px] font-bold text-brand-500 dark:text-brand-400 uppercase tracking-wide">
            Submit →
          </span>
        )}
      </div>
    </div>
  )

  return canSubmit ? <Link href={`/matches/${match.id}`} className="w-full block">{card}</Link> : card
}

function PlayerRow({
  name,
  score,
  isWinner,
  isLoser,
  isMe,
  showCrown,
}: {
  name: string | null
  score: number | null
  isWinner: boolean
  isLoser: boolean
  isMe: boolean
  showCrown: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 ${
        isWinner
          ? 'bg-brand-50 dark:bg-brand-900/20'
          : isLoser
          ? 'opacity-40 dark:opacity-30'
          : ''
      }`}
    >
      {/* Seed dot */}
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          isWinner ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      />
      <span
        className={`flex-1 text-xs truncate ${
          name
            ? isMe
              ? 'font-bold text-brand-600 dark:text-brand-400'
              : isWinner
              ? 'font-semibold text-gray-900 dark:text-white'
              : 'font-medium text-gray-700 dark:text-gray-300'
            : 'italic text-gray-400 dark:text-gray-600'
        }`}
      >
        {name ?? 'TBD'}
      </span>
      {showCrown && <Crown className="h-3 w-3 text-yellow-500 fill-yellow-400 shrink-0" />}
      {score !== null && (
        <span
          className={`text-sm font-extrabold tabular-nums shrink-0 ${
            isWinner
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {score}
        </span>
      )}
    </div>
  )
}

function StatusPip({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    scheduled:             { color: 'bg-gray-400',        label: 'Scheduled' },
    awaiting_confirmation: { color: 'bg-amber-400',       label: 'Awaiting' },
    completed:             { color: 'bg-brand-500',       label: 'Done' },
    walkover:              { color: 'bg-purple-400',      label: 'Walkover' },
    pending:               { color: 'bg-gray-300 dark:bg-gray-600', label: 'Pending' },
  }
  const s = map[status] ?? { color: 'bg-gray-300', label: status }
  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} />
      <span className="text-[10px] text-gray-400 dark:text-gray-500">{s.label}</span>
    </span>
  )
}
