'use client'

import { useState } from 'react'

const formats = [
  {
    id: 'knockout',
    label: 'Knockout',
    emoji: '⚡',
    color: 'text-red-500',
    activeBg: 'bg-red-500',
    title: 'Single Elimination',
    desc: "Lose once and you're out. The fastest, most dramatic format — perfect for small groups who want a clear winner quickly.",
    details: ['Each match eliminates one player', 'Automatic bracket seeding', 'Final match crowns the champion', 'Ideal for 4–16 players'],
    tagColor: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  },
  {
    id: 'round_robin',
    label: 'Round Robin',
    emoji: '🔄',
    color: 'text-blue-500',
    activeBg: 'bg-blue-500',
    title: 'Everyone Plays Everyone',
    desc: 'Every player faces every other player. The most wins takes the crown. No one gets knocked out early.',
    details: ['Guaranteed matches for everyone', 'Ranking by wins', 'Most fair for equal skill groups', 'Ideal for 4–8 players'],
    tagColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'league',
    label: 'League',
    emoji: '📋',
    color: 'text-purple-500',
    activeBg: 'bg-purple-500',
    title: 'Full Points Table',
    desc: '3 points for a win, 1 for a draw, 0 for a loss. The real football experience with a live standings table.',
    details: ['3W / 1D / 0L points system', 'Live standings table', 'Goal difference tiebreaker', 'Ideal for 4–10 players'],
    tagColor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  },
  {
    id: 'group_knockout',
    label: 'Group Stage',
    emoji: '🏆',
    color: 'text-amber-500',
    activeBg: 'bg-amber-500',
    title: 'Groups + Knockout',
    desc: 'Players are split into groups for a round-robin phase, then top players advance to a knockout bracket — just like the World Cup.',
    details: ['Group stage with standings', 'Top players advance', 'Knockout bracket finals', 'Ideal for 8–16 players'],
    tagColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  },
]

export function FormatTabs() {
  const [active, setActive] = useState('knockout')
  const current = formats.find((f) => f.id === active)!

  return (
    <div>
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {formats.map((f) => (
          <button
            key={f.id}
            onClick={() => setActive(f.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 ${
              active === f.id
                ? `${f.activeBg} text-white shadow-md`
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span>{f.emoji}</span>
            {f.label}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl shrink-0">
            {current.emoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{current.title}</h3>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${current.tagColor}`}>{current.label}</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">{current.desc}</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {current.details.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
