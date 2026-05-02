'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

interface Props {
  tournamentId: string
  showWinner: boolean
  showTopScorer: boolean
}

export function CardDownloadButtons({ tournamentId, showWinner, showTopScorer }: Props) {
  const [loadingWinner, setLoadingWinner] = useState(false)
  const [loadingScorer, setLoadingScorer] = useState(false)

  async function downloadCard(type: 'winner-card' | 'top-scorer-card', setLoading: (v: boolean) => void) {
    setLoading(true)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/${type}`)
      if (!res.ok) {
        const text = await res.text()
        alert(text || 'Could not generate card')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to download card. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!showWinner && !showTopScorer) return null

  return (
    <div className="flex flex-wrap gap-4 justify-center">
      {showWinner && (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/tournaments/${tournamentId}/winner-card`}
            alt="Winner Card"
            className="rounded-xl shadow-2xl shadow-yellow-500/20 border border-yellow-500/20"
            style={{ width: 210, height: 300, objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <button
            onClick={() => downloadCard('winner-card', setLoadingWinner)}
            disabled={loadingWinner}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2 text-sm font-semibold text-black hover:from-yellow-400 hover:to-amber-400 disabled:opacity-60 transition-all shadow-lg shadow-yellow-500/20"
          >
            <Download className="h-4 w-4" />
            {loadingWinner ? 'Generating…' : 'Download Winner Card'}
          </button>
        </div>
      )}
      {showTopScorer && (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/tournaments/${tournamentId}/top-scorer-card`}
            alt="Top Scorer Card"
            className="rounded-xl shadow-2xl shadow-blue-500/20 border border-blue-500/20"
            style={{ width: 210, height: 300, objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <button
            onClick={() => downloadCard('top-scorer-card', setLoadingScorer)}
            disabled={loadingScorer}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20"
          >
            <Download className="h-4 w-4" />
            {loadingScorer ? 'Generating…' : 'Download Top Scorer Card'}
          </button>
        </div>
      )}
    </div>
  )
}
