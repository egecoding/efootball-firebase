'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface StatsMatch {
  id: string
  player1_id: string | null
  player1_name: string | null
  player2_id: string | null
  player2_name: string | null
  player1_score: number | null
  player2_score: number | null
  winner_id?: string | null
  status: string
}

interface TournamentStatsProps {
  matches: StatsMatch[]
  profileMap: Record<string, { display_name?: string | null; username?: string | null }>
  winnerName: string | null
}

function resolveName(
  id: string | null,
  name: string | null,
  profileMap: Record<string, { display_name?: string | null; username?: string | null }>
): string {
  if (id && profileMap[id]) {
    return profileMap[id].display_name ?? profileMap[id].username ?? name ?? 'Unknown'
  }
  return name ?? 'Unknown'
}

export function TournamentStats({ matches, profileMap, winnerName }: TournamentStatsProps) {
  const [open, setOpen] = useState(false)

  const completed = matches.filter(
    (m) => (m.status === 'completed' || m.status === 'walkover') &&
      m.player1_score !== null && m.player2_score !== null
  )

  if (completed.length === 0) return null

  // Top scorer: player with most goals scored
  const goalTally: Record<string, { name: string; goals: number }> = {}
  let totalGoals = 0

  for (const m of completed) {
    const p1 = m.player1_score ?? 0
    const p2 = m.player2_score ?? 0
    totalGoals += p1 + p2

    if (m.player1_id || m.player1_name) {
      const key = m.player1_id ?? m.player1_name!
      const name = resolveName(m.player1_id, m.player1_name, profileMap)
      goalTally[key] = { name, goals: (goalTally[key]?.goals ?? 0) + p1 }
    }
    if (m.player2_id || m.player2_name) {
      const key = m.player2_id ?? m.player2_name!
      const name = resolveName(m.player2_id, m.player2_name, profileMap)
      goalTally[key] = { name, goals: (goalTally[key]?.goals ?? 0) + p2 }
    }
  }

  const topScorer = Object.values(goalTally).sort((a, b) => b.goals - a.goals)[0] ?? null

  // Biggest win: highest goal difference
  const biggestWin = completed.reduce<StatsMatch | null>((best, m) => {
    const diff = Math.abs((m.player1_score ?? 0) - (m.player2_score ?? 0))
    const bestDiff = best ? Math.abs((best.player1_score ?? 0) - (best.player2_score ?? 0)) : -1
    return diff > bestDiff ? m : best
  }, null)

  // Closest match: smallest non-zero goal difference (excluding draws)
  const nonDraws = completed.filter(
    (m) => m.player1_score !== m.player2_score
  )
  const closestMatch = nonDraws.reduce<StatsMatch | null>((best, m) => {
    const diff = Math.abs((m.player1_score ?? 0) - (m.player2_score ?? 0))
    const bestDiff = best ? Math.abs((best.player1_score ?? 0) - (best.player2_score ?? 0)) : Infinity
    return diff < bestDiff ? m : best
  }, null)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span>📊</span> Tournament Stats
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {winnerName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">🏆 Champion</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{winnerName}</span>
            </div>
          )}

          {topScorer && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">⚽ Top Scorer</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {topScorer.name}
                <span className="ml-1.5 text-brand-500 font-bold">{topScorer.goals} goals</span>
              </span>
            </div>
          )}

          {biggestWin && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">💥 Biggest Win</span>
              <span className="text-sm text-gray-900 dark:text-white">
                <span className="font-semibold">{resolveName(biggestWin.player1_id, biggestWin.player1_name, profileMap)}</span>
                {' '}{biggestWin.player1_score}–{biggestWin.player2_score}{' '}
                <span className="font-semibold">{resolveName(biggestWin.player2_id, biggestWin.player2_name, profileMap)}</span>
              </span>
            </div>
          )}

          {closestMatch && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">⚖️ Closest Match</span>
              <span className="text-sm text-gray-900 dark:text-white">
                <span className="font-semibold">{resolveName(closestMatch.player1_id, closestMatch.player1_name, profileMap)}</span>
                {' '}{closestMatch.player1_score}–{closestMatch.player2_score}{' '}
                <span className="font-semibold">{resolveName(closestMatch.player2_id, closestMatch.player2_name, profileMap)}</span>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📈 Total Goals</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{totalGoals}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">🎮 Matches Played</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{completed.length}</span>
          </div>
        </div>
      )}
    </div>
  )
}
