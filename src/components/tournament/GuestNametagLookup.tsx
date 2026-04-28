'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trophy, ChevronRight } from 'lucide-react'
import { TournamentStatusBadge } from '@/components/ui/Badge'

interface Result {
  participantId: string
  name: string
  tournament: {
    id: string
    title: string
    status: string
    game_name: string
    format: string | null
  } | null
}

export function GuestNametagLookup() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Result[] | null>(null)
  const [error, setError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    setResults(null)

    const res = await fetch(`/api/participants/lookup?name=${encodeURIComponent(name.trim())}`)
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    if (!data.results || data.results.length === 0) {
      setError('No tournaments found for that nametag.')
      return
    }
    setResults(data.results)
  }

  function access(result: Result) {
    if (!result.tournament) return
    localStorage.setItem(`participant_${result.tournament.id}`, result.participantId)
    router.push(`/tournaments/${result.tournament.id}/portal`)
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-yellow-500/40 hover:border-yellow-400/70 bg-yellow-500/5 hover:bg-yellow-500/10 px-4 py-3 text-sm transition-colors"
        >
          <Search className="h-4 w-4 text-yellow-400" />
          <span className="text-yellow-400 font-semibold">Access your tournaments with your nametag</span>
        </button>
      ) : (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-200 mb-0.5">Find your tournaments</p>
            <p className="text-xs text-gray-500">Enter the nametag you used when joining a tournament.</p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PhilEFC"
              autoFocus
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl text-sm font-bold text-white transition-colors"
            >
              {loading ? '…' : 'Search'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setResults(null); setError('') }}
              className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </form>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {results && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">Found {results.length} tournament{results.length !== 1 ? 's' : ''} — tap to enter</p>
              {results.map((r) => r.tournament && (
                <button
                  key={r.participantId}
                  onClick={() => access(r)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-brand-500/40 transition-all text-left group"
                >
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-brand-400 transition-colors">
                      {r.tournament.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TournamentStatusBadge status={r.tournament.status as 'draft' | 'open' | 'in_progress' | 'completed'} />
                      <span className="text-xs text-gray-500">as <span className="text-gray-400 font-medium">{r.name}</span></span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-brand-400 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
