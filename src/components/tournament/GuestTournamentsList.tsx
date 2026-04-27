'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, Users, ExternalLink } from 'lucide-react'
import { TournamentStatusBadge } from '@/components/ui/Badge'

interface GuestEntry {
  tournamentId: string
  participantId: string
}

interface TournamentInfo {
  id: string
  title: string
  game_name: string
  status: string
  format: string | null
  max_participants: number
}

export function GuestTournamentsList() {
  const [entries, setEntries] = useState<(GuestEntry & { tournament: TournamentInfo })[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Collect all participant_* keys from localStorage
    const found: GuestEntry[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('participant_')) {
        const tournamentId = key.replace('participant_', '')
        const participantId = localStorage.getItem(key) ?? ''
        if (tournamentId && participantId) {
          found.push({ tournamentId, participantId })
        }
      }
    }

    if (found.length === 0) {
      setLoaded(true)
      return
    }

    // Fetch tournament details for each entry
    Promise.all(
      found.map(async (entry) => {
        try {
          const res = await fetch(`/api/tournaments/${entry.tournamentId}`)
          if (!res.ok) {
            // Tournament may have been deleted — remove stale entry
            localStorage.removeItem(`participant_${entry.tournamentId}`)
            return null
          }
          const tournament: TournamentInfo = await res.json()
          return { ...entry, tournament }
        } catch {
          return null
        }
      })
    ).then((results) => {
      setEntries(
        results.filter(
          (r): r is GuestEntry & { tournament: TournamentInfo } =>
            r !== null && r.tournament !== null
        )
      )
      setLoaded(true)
    })
  }, [])

  if (!loaded || entries.length === 0) return null

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-brand-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Tournaments</h2>
        <span className="ml-1 rounded-full bg-brand-100 dark:bg-brand-900/30 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-400">
          {entries.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ tournamentId, tournament }) => (
          <Link
            key={tournamentId}
            href={`/tournaments/${tournamentId}/portal`}
            className="group flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-brand-400 dark:hover:border-brand-600 hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
                {tournament.title}
              </p>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400 mt-0.5" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{tournament.game_name}</p>
            <div className="flex items-center justify-between mt-auto pt-1">
              <TournamentStatusBadge status={tournament.status as 'draft' | 'open' | 'in_progress' | 'completed'} />
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Users className="h-3 w-3" />
                {tournament.format === 'knockout' ? 'Knockout' : tournament.format === 'league' ? 'League' : 'Round Robin'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
