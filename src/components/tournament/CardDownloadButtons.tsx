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
    <div className="flex flex-wrap gap-2">
      {showWinner && (
        <button
          onClick={() => downloadCard('winner-card', setLoadingWinner)}
          disabled={loadingWinner}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2 text-sm font-semibold text-black hover:from-yellow-400 hover:to-amber-400 disabled:opacity-60 transition-all shadow-lg shadow-yellow-500/20"
        >
          <Download className="h-4 w-4" />
          {loadingWinner ? 'Generating…' : 'Download Winner Card'}
        </button>
      )}
      {showTopScorer && (
        <button
          onClick={() => downloadCard('top-scorer-card', setLoadingScorer)}
          disabled={loadingScorer}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-semibold text-white hover:from-orange-400 hover:to-red-400 disabled:opacity-60 transition-all shadow-lg shadow-orange-500/20"
        >
          <Download className="h-4 w-4" />
          {loadingScorer ? 'Generating…' : 'Download Top Scorer Card'}
        </button>
      )}
    </div>
  )
}
