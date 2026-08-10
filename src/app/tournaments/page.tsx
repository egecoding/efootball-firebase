import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { NOINDEX } from '@/lib/seo'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import type { TournamentWithOrganizer } from '@/types/database'

export const revalidate = 30

const DESCRIPTION =
  'Find and join free eFootball tournaments. Browse live brackets, upcoming cups, and completed tournaments from the eFootball community — no account needed to join.'

/**
 * `?q=` is free text, so the filtered URL space is unbounded. Every variant
 * canonicals back to the clean /tournaments, and filtered views additionally
 * carry noindex/follow — the canonical alone is only a hint, while `follow`
 * keeps crawl flowing through to the tournament detail pages.
 */
export function generateMetadata({ searchParams }: PageProps): Metadata {
  const filtered = !!(searchParams.q || searchParams.status || searchParams.format)

  return {
    title: 'Browse eFootball Tournaments',
    description: DESCRIPTION,
    alternates: { canonical: '/tournaments' },
    ...(filtered ? { robots: NOINDEX } : {}),
    openGraph: {
      title: 'Browse eFootball Tournaments — eFootball Cup',
      description:
        'Find and join free eFootball tournaments. Browse live brackets, upcoming cups, and completed tournaments from the eFootball community.',
      type: 'website',
    },
  }
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in_progress', label: 'Live' },
  { value: 'completed', label: 'Completed' },
] as const

interface PageProps {
  searchParams: { q?: string; status?: string; format?: string }
}

export default async function TournamentsPage({ searchParams }: PageProps) {
  const query = searchParams.q ?? ''
  const status = searchParams.status ?? ''
  const format = searchParams.format ?? ''
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let qb = supabase
    .from('tournaments')
    .select(
      'id, organizer_id, title, description, game_name, format, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
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
  if (status) {
    qb = qb.eq('status', status)
  }
  if (format) {
    qb = qb.eq('format', format)
  }

  const [{ data: tournaments }, { data: allPublicFormats }] = await Promise.all([
    qb,
    supabase.from('tournaments').select('format').eq('is_public', true),
  ])

  const formats = Array.from(
    new Set((allPublicFormats ?? []).map((t) => t.format as string))
  ).sort()

  function filterHref(next: Partial<{ q: string; status: string; format: string }>) {
    const params = new URLSearchParams()
    const merged = { q: query, status, format, ...next }
    if (merged.q) params.set('q', merged.q)
    if (merged.status) params.set('status', merged.status)
    if (merged.format) params.set('format', merged.format)
    const qs = params.toString()
    return qs ? `/tournaments?${qs}` : '/tournaments'
  }

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
      <form method="get" className="mb-4">
        {status && <input type="hidden" name="status" value={status} />}
        {format && <input type="hidden" name="format" value={format} />}
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

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={filterHref({ status: f.value })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              status === f.value
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Format filter */}
      {formats.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link
            href={filterHref({ format: '' })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              format === ''
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All formats
          </Link>
          {formats.map((f) => (
            <Link
              key={f}
              href={filterHref({ format: f })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize ${
                format === f
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {f.replace(/_/g, ' ')}
            </Link>
          ))}
        </div>
      )}

      {tournaments && tournaments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tournaments as unknown as TournamentWithOrganizer[]).map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400 dark:text-gray-500 text-lg mb-4">
            {query || status || format ? 'No tournaments found for your filters.' : 'No tournaments yet.'}
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
