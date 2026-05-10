'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ScorerMatch {
  id: string
  player1_id: string | null
  player1_name: string | null
  player2_id: string | null
  player2_name: string | null
  player1_score: number | null
  player2_score: number | null
  status: string
}

interface TopScorersTableProps {
  matches: ScorerMatch[]
  profileMap: Record<string, { display_name?: string | null; username?: string | null; avatar_url?: string | null }>
}

interface ScorerEntry {
  key: string
  name: string
  played: number
  wins: number
  losses: number
  draws: number
  goalsFor: number
  goalsAgainst: number
  avatarUrl?: string | null
}

const AVATAR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
]

function nameColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function MiniAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const initial = name.charAt(0).toUpperCase()
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={name} className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-white dark:ring-gray-900" />
    )
  }
  return (
    <div className={`h-7 w-7 rounded-full ${nameColor(name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initial}
    </div>
  )
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

const RANK_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10 border-l-2 border-yellow-400',
  2: 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/40 dark:to-slate-800/20 border-l-2 border-gray-300 dark:border-gray-600',
  3: 'bg-gradient-to-r from-orange-50 to-amber-50/50 dark:from-orange-900/20 dark:to-orange-900/5 border-l-2 border-orange-300 dark:border-orange-700',
}

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export function TopScorersTable({ matches, profileMap }: TopScorersTableProps) {
  const [open, setOpen] = useState(true)

  const completed = matches.filter(
    (m) =>
      (m.status === 'completed' || m.status === 'walkover') &&
      m.player1_score !== null &&
      m.player2_score !== null
  )

  const scorerMap: Record<string, ScorerEntry> = {}

  function ensure(key: string, id: string | null, name: string | null) {
    if (!scorerMap[key]) {
      scorerMap[key] = {
        key,
        name: resolveName(id, name, profileMap),
        played: 0, wins: 0, losses: 0, draws: 0,
        goalsFor: 0, goalsAgainst: 0,
        avatarUrl: id ? profileMap[id]?.avatar_url : null,
      }
    }
  }

  for (const m of completed) {
    const p1Key = m.player1_id ?? m.player1_name
    const p2Key = m.player2_id ?? m.player2_name
    const s1 = m.player1_score ?? 0
    const s2 = m.player2_score ?? 0

    if (p1Key != null) {
      ensure(p1Key, m.player1_id, m.player1_name)
      scorerMap[p1Key].played += 1
      scorerMap[p1Key].goalsFor += s1
      scorerMap[p1Key].goalsAgainst += s2
      if (s1 > s2) scorerMap[p1Key].wins += 1
      else if (s1 < s2) scorerMap[p1Key].losses += 1
      else scorerMap[p1Key].draws += 1
    }

    if (p2Key != null) {
      ensure(p2Key, m.player2_id, m.player2_name)
      scorerMap[p2Key].played += 1
      scorerMap[p2Key].goalsFor += s2
      scorerMap[p2Key].goalsAgainst += s1
      if (s2 > s1) scorerMap[p2Key].wins += 1
      else if (s2 < s1) scorerMap[p2Key].losses += 1
      else scorerMap[p2Key].draws += 1
    }
  }

  // Sort by goals scored desc, then wins, then goal difference
  const scorers = Object.values(scorerMap).sort((a, b) =>
    b.goalsFor - a.goalsFor ||
    b.wins - a.wins ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
  )

  const maxGoals = scorers[0]?.goalsFor ?? 1

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-semibold text-gray-900 dark:text-white">⚽ Player Stats</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-400" />
          : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
          {scorers.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-gray-400 dark:text-gray-500">
              No matches completed yet — check back soon.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-400 text-[10px] uppercase tracking-wider w-10">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-400 text-[10px] uppercase tracking-wider">Player</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-green-500 text-[10px] uppercase tracking-wider w-10" title="Wins">W</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-red-400 text-[10px] uppercase tracking-wider w-10" title="Losses">L</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-brand-500 text-[10px] uppercase tracking-wider w-10" title="Goals Scored">GF</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-400 text-[10px] uppercase tracking-wider w-10 hidden sm:table-cell" title="Matches Played">GP</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-400 text-[10px] uppercase tracking-wider w-10 hidden sm:table-cell" title="Draws">D</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-400 text-[10px] uppercase tracking-wider w-10 hidden sm:table-cell" title="Goals Against">GA</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-purple-500 text-[10px] uppercase tracking-wider w-12 hidden sm:table-cell" title="Goal Difference">GD</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-400 text-[10px] uppercase tracking-wider w-12 hidden sm:table-cell" title="Average goals scored per game">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {scorers.map((s, idx) => {
                  const rank = idx + 1
                  const gd = s.goalsFor - s.goalsAgainst
                  const avg = s.played > 0 ? (s.goalsFor / s.played).toFixed(1) : '0.0'
                  const barWidth = maxGoals > 0 ? (s.goalsFor / maxGoals) * 100 : 0
                  const rowStyle = RANK_STYLES[rank] ?? ''
                  const medal = RANK_MEDALS[rank]

                  return (
                    <tr
                      key={s.key}
                      className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${rowStyle}`}
                    >
                      {/* Rank */}
                      <td className="px-3 py-3 text-center">
                        {medal ? (
                          <span className="text-base leading-none">{medal}</span>
                        ) : (
                          <span className="text-xs text-gray-400 font-mono tabular-nums">{rank}</span>
                        )}
                      </td>

                      {/* Player name + goal bar */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <MiniAvatar name={s.name} avatarUrl={s.avatarUrl} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">
                              {s.name}
                            </p>
                            <div className="mt-1 h-1.5 w-full max-w-[80px] sm:max-w-[120px] rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                                  : rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-600'
                                  : rank === 3 ? 'bg-gradient-to-r from-orange-300 to-orange-400'
                                  : 'bg-brand-500'
                                }`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* W — always visible */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 tabular-nums">{s.wins}</span>
                      </td>

                      {/* L — always visible */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-semibold text-red-500 dark:text-red-400 tabular-nums">{s.losses}</span>
                      </td>

                      {/* GF — always visible */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold tabular-nums ${rank === 1 ? 'text-amber-500' : 'text-brand-500'}`}>
                          {s.goalsFor}
                        </span>
                      </td>

                      {/* GP — hidden on mobile */}
                      <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400 tabular-nums hidden sm:table-cell">{s.played}</td>

                      {/* D — hidden on mobile */}
                      <td className="px-3 py-3 text-center text-xs text-gray-400 tabular-nums hidden sm:table-cell">{s.draws}</td>

                      {/* GA — hidden on mobile */}
                      <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400 tabular-nums hidden sm:table-cell">{s.goalsAgainst}</td>

                      {/* GD — hidden on mobile */}
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`text-xs font-bold tabular-nums ${gd > 0 ? 'text-purple-500 dark:text-purple-400' : 'text-gray-400'}`}>
                          {gd > 0 ? `+${gd}` : gd}
                        </span>
                      </td>

                      {/* Avg — hidden on mobile */}
                      <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400 tabular-nums hidden sm:table-cell">{avg}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
