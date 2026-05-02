'use client'

import { useEffect, useState } from 'react'
import { Download, Trophy, Star } from 'lucide-react'
import type { Achievement } from '@/app/api/me/achievements/route'

async function downloadCard(tournamentId: string, type: 'winner-card' | 'top-scorer-card') {
  const res = await fetch(`/api/tournaments/${tournamentId}/${type}`)
  if (!res.ok) { alert('Could not generate card'); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${type}.png`
  a.click()
  URL.revokeObjectURL(url)
}

function AwardCard({ achievement, type }: { achievement: Achievement; type: 'winner' | 'top-scorer' }) {
  const [downloading, setDownloading] = useState(false)
  const [hidden, setHidden] = useState(false)

  const apiType = type === 'winner' ? 'winner-card' : 'top-scorer-card'
  const label = type === 'winner' ? 'Winner Card' : 'Top Scorer Card'
  const borderClass = type === 'winner'
    ? 'border-yellow-500/25 shadow-yellow-500/15'
    : 'border-blue-500/25 shadow-blue-500/15'
  const btnClass = type === 'winner'
    ? 'from-yellow-500 to-amber-500 text-black hover:from-yellow-400 hover:to-amber-400 shadow-yellow-500/20'
    : 'from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'

  if (hidden) return null

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/tournaments/${achievement.tournamentId}/${apiType}`}
        alt={label}
        className={`rounded-xl shadow-2xl border ${borderClass}`}
        style={{ width: 200, height: 286, objectFit: 'cover' }}
        onError={() => setHidden(true)}
      />
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-[200px] truncate">
        {achievement.tournamentTitle}
      </p>
      <button
        disabled={downloading}
        onClick={async () => {
          setDownloading(true)
          try { await downloadCard(achievement.tournamentId, apiType) }
          finally { setDownloading(false) }
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r ${btnClass} px-3 py-1.5 text-xs font-semibold disabled:opacity-60 transition-all shadow-lg`}
      >
        <Download className="h-3.5 w-3.5" />
        {downloading ? 'Generating…' : `Download`}
      </button>
    </div>
  )
}

export function MyAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/me/achievements')
      .then((r) => r.json())
      .then((data) => { setAchievements(Array.isArray(data) ? data : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || achievements.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Star className="h-4 w-4 text-yellow-500" />
        Your Awards
      </h2>
      <div className="flex flex-wrap gap-6">
        {achievements.map((a) => (
          <div key={a.tournamentId} className="flex flex-wrap gap-4">
            {a.isWinner && (
              <AwardCard achievement={a} type="winner" />
            )}
            {a.isTopScorer && (
              <AwardCard achievement={a} type="top-scorer" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
