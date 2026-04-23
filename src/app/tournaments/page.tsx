import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import type { TournamentWithOrganizer } from '@/types/database'

export const revalidate = 30

interface PageProps {
  searchParams: { q?: string }
}

export default async function TournamentsPage({ searchParams }: PageProps) {
  const query = searchParams.q ?? ''
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let qb = supabase
    .from('tournaments')
    .select(
      'id, organizer_id, title, description, game_name, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(40)

  if (query.trim()) {
    qb = qb.textSearch('title', query.trim(), {
      type: 'websearch',
      config: 'english',
    })
  }

  const { data: tournaments } = await qb

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="section-title">Tournaments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {tournaments?.length ?? 0} tournament
            {tournaments?.length !== 1 ? 's' : ''} found
          </p>
        </div>
        {user && (
          <Link
            href="/tournaments/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Tournament
          </Link>
        )}
      </div>

      {/* Search */}
      <form method="get" className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            name="q"
            defaultValue={query}
            type="search"
            placeholder="Search tournaments…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </form>

      {tournaments && tournaments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tournaments as unknown as TournamentWithOrganizer[]).map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400 dark:text-gray-500 text-lg mb-4">
            {query ? 'No tournaments found for your search.' : 'No tournaments yet.'}
          </p>
          {user && (
            <Link
              href="/tournaments/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create the first one
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
