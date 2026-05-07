import Link from 'next/link'
import type { RoundWithMatches, MatchWithPlayers } from '@/types/database'

interface HomeAwayBracketViewProps {
  rounds: RoundWithMatches[]
  profileMap: Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }>
  currentUserId?: string
  organizerId?: string
}

export function HomeAwayBracketView({ rounds, profileMap, currentUserId, organizerId }: HomeAwayBracketViewProps) {
  const sorted = [...rounds].sort((a, b) => a.round_number - b.round_number)

  const stages: { name: string; leg1Matches: MatchWithPlayers[]; leg2Matches: MatchWithPlayers[] | null }[] = []

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    if (r.round_name.includes('1st Leg')) {
      const next = sorted[i + 1]
      const baseName = r.round_name.replace(' — 1st Leg', '')
      stages.push({
        name: baseName,
        leg1Matches: r.matches,
        leg2Matches: next?.matches ?? null,
      })
      i++
    } else {
      stages.push({ name: r.round_name, leg1Matches: r.matches, leg2Matches: null })
    }
  }

  function resolveName(id: string | null, fallback: string | null) {
    if (id && profileMap[id]) {
      return profileMap[id].display_name ?? profileMap[id].username ?? fallback ?? 'Player'
    }
    return fallback ?? 'TBD'
  }

  return (
    <div className="space-y-8">
      {stages.map((stage) => (
        <div key={stage.name} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{stage.name}</span>
            {stage.leg2Matches && (
              <span className="ml-2 text-xs text-gray-400">2 legs · aggregate decides</span>
            )}
          </div>

          {stage.leg2Matches ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stage.leg1Matches.map((leg1) => {
                const leg2 = stage.leg2Matches!.find((m) => m.tie_id === leg1.tie_id)
                const nameA = resolveName(leg1.player1_id, leg1.player1_name)
                const nameB = resolveName(leg1.player2_id, leg1.player2_name)

                const l1p1 = leg1.player1_score ?? null
                const l1p2 = leg1.player2_score ?? null
                const l2p1 = leg2?.player1_score ?? null
                const l2p2 = leg2?.player2_score ?? null

                const aggA = l1p1 !== null && l2p2 !== null ? l1p1 + l2p2 : null
                const aggB = l1p2 !== null && l2p1 !== null ? l1p2 + l2p1 : null
                const bothDone = leg1.status === 'completed' && (leg2?.status === 'completed' || leg2?.status === 'walkover')
                const winnerA = bothDone && aggA !== null && aggB !== null && aggA > aggB
                const winnerB = bothDone && aggA !== null && aggB !== null && aggB > aggA

                return (
                  <div key={leg1.id} className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`font-semibold text-sm ${winnerA ? 'text-green-600 dark:text-green-400' : winnerB ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {nameA}
                      </span>
                      <span className="text-gray-400 text-xs">vs</span>
                      <span className={`font-semibold text-sm ${winnerB ? 'text-green-600 dark:text-green-400' : winnerA ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {nameB}
                      </span>
                      {aggA !== null && aggB !== null && (
                        <span className="ml-auto text-xs font-bold text-gray-500 dark:text-gray-400">
                          Agg: <span className={winnerA ? 'text-green-600 dark:text-green-400' : ''}>{aggA}</span>
                          {' – '}
                          <span className={winnerB ? 'text-green-600 dark:text-green-400' : ''}>{aggB}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        1st Leg:{' '}
                        {l1p1 !== null && l1p2 !== null
                          ? <span className="font-semibold text-gray-700 dark:text-gray-300">{l1p1}–{l1p2}</span>
                          : <span className="italic">pending</span>}
                      </span>
                      <span>
                        2nd Leg:{' '}
                        {l2p1 !== null && l2p2 !== null
                          ? <span className="font-semibold text-gray-700 dark:text-gray-300">{l2p2}–{l2p1}</span>
                          : <span className="italic">pending</span>}
                      </span>
                    </div>
                    {(() => {
                      const isPlayerInTie = currentUserId && (
                        leg1.player1_id === currentUserId || leg1.player2_id === currentUserId
                      )
                      const canAct = isPlayerInTie || (currentUserId && currentUserId === organizerId)
                      if (!canAct) return null

                      const leg1Status = leg1.status
                      const leg2Status = leg2?.status ?? 'pending'

                      return (
                        <div className="flex flex-wrap gap-4 mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800">
                          {(leg1Status === 'scheduled' || leg1Status === 'awaiting_confirmation') ? (
                            <Link href={`/matches/${leg1.id}`} className="text-xs font-semibold text-brand-500 hover:text-brand-600 dark:text-brand-400">
                              Submit Leg 1 →
                            </Link>
                          ) : leg1Status === 'completed' || leg1Status === 'walkover' ? (
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">✓ Leg 1 done</span>
                          ) : null}

                          {leg2Status === 'pending' ? (
                            <span className="text-xs text-gray-400 italic">Leg 2 — awaiting Leg 1 confirmation</span>
                          ) : (leg2Status === 'scheduled' || leg2Status === 'awaiting_confirmation') && leg2 ? (
                            <Link href={`/matches/${leg2.id}`} className="text-xs font-semibold text-brand-500 hover:text-brand-600 dark:text-brand-400">
                              Submit Leg 2 →
                            </Link>
                          ) : (leg2Status === 'completed' || leg2Status === 'walkover') ? (
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">✓ Leg 2 done</span>
                          ) : null}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stage.leg1Matches.map((m) => {
                const nameA = resolveName(m.player1_id, m.player1_name)
                const nameB = resolveName(m.player2_id, m.player2_name)
                return (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{nameA}</span>
                    <span className="text-gray-400 text-xs">vs</span>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{nameB}</span>
                    {m.player1_score !== null && m.player2_score !== null && (
                      <span className="ml-auto font-bold text-sm text-gray-700 dark:text-gray-300">
                        {m.player1_score}–{m.player2_score}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
