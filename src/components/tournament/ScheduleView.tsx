import Link from 'next/link'
import { MatchStatusBadge } from '@/components/ui/Badge'
import type { RoundWithMatches, MatchWithPlayers, Profile } from '@/types/database'

interface ScheduleViewProps {
  rounds: RoundWithMatches[]
  currentUserId?: string
  organizerId?: string
  profileMap?: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
}

export function ScheduleView({ rounds, currentUserId, organizerId, profileMap = {} }: ScheduleViewProps) {
  if (!rounds || rounds.length === 0) return null

  const isOrganizer = !!organizerId && currentUserId === organizerId

  return (
    <div className="flex flex-col gap-6">
      {rounds.map((round) => {
        const sorted = [...(round.matches ?? [])].sort((a, b) => a.match_number - b.match_number)
        return (
          <div key={round.id}>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {round.round_name}
            </h3>
            <div className="flex flex-col gap-2">
              {sorted.map((match) => {
                const m = match as unknown as MatchWithPlayers & { player1_name?: string | null; player2_name?: string | null }
                const p1Profile = m.player1_id ? profileMap[m.player1_id] : null
                const p2Profile = m.player2_id ? profileMap[m.player2_id] : null
                const p1Name = p1Profile ? (p1Profile.display_name ?? p1Profile.username) : (m.player1_name ?? 'TBD')
                const p2Name = p2Profile ? (p2Profile.display_name ?? p2Profile.username) : (m.player2_name ?? 'TBD')

                const isActivePlayer = currentUserId &&
                  (m.player1_id === currentUserId || m.player2_id === currentUserId)
                const isSubmittable =
                  (isActivePlayer || isOrganizer) &&
                  (m.status === 'scheduled' || m.status === 'awaiting_confirmation')

                const isDone = m.status === 'completed' || m.status === 'walkover'

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3"
                  >
                    <span className="text-xs font-mono text-gray-400 w-5 shrink-0">#{m.match_number}</span>

                    {/* Player 1 */}
                    <span className={`flex-1 text-sm font-medium truncate text-right ${
                      isDone && m.winner_id === m.player1_id ? 'text-brand-600 dark:text-brand-400 font-bold' :
                      isDone && m.winner_id !== m.player1_id && m.winner_id !== null ? 'text-gray-400' :
                      'text-gray-800 dark:text-gray-200'
                    }`}>
                      {p1Name}
                    </span>

                    {/* Score / vs */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDone ? (
                        <>
                          <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white w-5 text-center">
                            {m.player1_score ?? '-'}
                          </span>
                          <span className="text-xs text-gray-400">–</span>
                          <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white w-5 text-center">
                            {m.player2_score ?? '-'}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 px-1">vs</span>
                      )}
                    </div>

                    {/* Player 2 */}
                    <span className={`flex-1 text-sm font-medium truncate ${
                      isDone && m.winner_id === m.player2_id ? 'text-brand-600 dark:text-brand-400 font-bold' :
                      isDone && m.winner_id !== m.player2_id && m.winner_id !== null ? 'text-gray-400' :
                      'text-gray-800 dark:text-gray-200'
                    }`}>
                      {p2Name}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <MatchStatusBadge status={m.status} />
                      {isSubmittable && (
                        <Link
                          href={`/matches/${m.id}`}
                          className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                        >
                          Submit →
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
