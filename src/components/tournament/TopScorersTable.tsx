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
  goals: number
  matches: number
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
  profileMap: Record<string, { display_name?: string | null; username?: string | null; avatar_url?: string | null }>
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

  for (const m of completed) {
    const p1Key = m.player1_id ?? m.player1_name
    const p2Key = m.player2_id ?? m.player2_name

    if (p1Key != null) {
      if (!scorerMap[p1Key]) {
        scorerMap[p1Key] = {
          key: p1Key,
          name: resolveName(m.player1_id, m.player1_name, profileMap),
          goals: 0,
          matches: 0,
          avatarUrl: m.player1_id ? profileMap[m.player1_id]?.avatar_url : null,
        }
      }
      scorerMap[p1Key].goals += m.player1_score ?? 0
      scorerMap[p1Key].matches += 1
    }

    if (p2Key != null) {
      if (!scorerMap[p2Key]) {
        scorerMap[p2Key] = {
          key: p2Key,
          name: resolveName(m.player2_id, m.player2_name, profileMap),
          goals: 0,
          matches: 0,
          avatarUrl: m.player2_id ? profileMap[m.player2_id]?.avatar_url : null,
        }
      }
      scorerMap[p2Key].goals += m.player2_score ?? 0
      scorerMap[p2Key].matches += 1
    }
  }

  const scorers = Object.values(scorerMap).sort(
    (a, b) => b.goals - a.goals || b.matches - a.matches
  )

  const maxGoals = scorers[0]?.goals ?? 1

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          ⚽ Top Scorers
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-400" />
          : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {scorers.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-gray-400 dark:text-gray-500">
              No matches completed yet — check back soon.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-[2rem_1fr_3.5rem_3rem_3.5rem] gap-0 px-4 py-2 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">#</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-9">Player</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">⚽</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center hidden sm:block">GP</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center hidden sm:block">Avg</span>
              </div>

              {/* Player rows */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {scorers.map((s, idx) => {
                  const rank = idx + 1
                  const avg = s.matches > 0 ? (s.goals / s.matches).toFixed(1) : '0.0'
                  const barWidth = maxGoals > 0 ? (s.goals / maxGoals) * 100 : 0
                  const rowStyle = RANK_STYLES[rank] ?? ''
                  const medal = RANK_MEDALS[rank]

                  return (
                    <div
                      key={s.key}
                      className={`grid grid-cols-[2rem_1fr_3.5rem_3rem_3.5rem] gap-0 px-4 py-3 items-center transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${rowStyle}`}
                    >
                      {/* Rank */}
                      <div className="flex justify-center">
                        {medal ? (
                          <span className="text-base leading-none">{medal}</span>
                        ) : (
                          <span className="text-xs text-gray-400 font-mono tabular-nums">{rank}</span>
                        )}
                      </div>

                      {/* Player name + goal bar */}
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <MiniAvatar name={s.name} avatarUrl={s.avatarUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                            {s.name}
                          </p>
                          {/* Goal bar */}
                          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                rank === 1
                                  ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                                  : rank === 2
                                  ? 'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-600'
                                  : rank === 3
                                  ? 'bg-gradient-to-r from-orange-300 to-orange-400'
                                  : 'bg-brand-500'
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Goals */}
                      <div className="text-center">
                        <span className={`text-sm font-bold tabular-nums ${rank === 1 ? 'text-amber-500' : 'text-brand-500'}`}>
                          {s.goals}
                        </span>
                      </div>

                      {/* GP */}
                      <div className="text-center hidden sm:block">
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{s.matches}</span>
                      </div>

                      {/* Avg */}
                      <div className="text-center hidden sm:block">
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{avg}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
