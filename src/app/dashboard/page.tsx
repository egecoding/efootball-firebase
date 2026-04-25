import Link from 'next/link'
import { Plus, Trophy, Swords, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import { Button } from '@/components/ui/Button'
import { MatchStatusBadge } from '@/components/ui/Badge'
import type { TournamentWithOrganizer } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: myTournaments }, { data: joined }, { data: myMatches }, { data: profile }] = await Promise.all([
    supabase
      .from('tournaments')
      .select(
        'id, organizer_id, title, description, game_name, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
      )
      .eq('organizer_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('participants')
      .select(
        'tournament_id, tournaments(id, organizer_id, title, description, game_name, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url))'
      )
      .eq('user_id', user!.id)
      .order('joined_at', { ascending: false })
      .limit(20),
    supabase
      .from('matches')
      .select('id, tournament_id, match_number, player1_id, player1_name, player2_id, player2_name, status, tournaments(title)')
      .or(`player1_id.eq.${user!.id},player2_id.eq.${user!.id}`)
      .in('status', ['scheduled', 'awaiting_confirmation'])
      .order('created_at', { ascending: true })
      .limit(20),
    supabase
      .from('profiles')
      .select('wins, losses')
      .eq('id', user!.id)
      .single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joinedTournaments: TournamentWithOrganizer[] = (joined ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => p.tournaments)
    .filter(
      (t: unknown): t is TournamentWithOrganizer =>
        t !== null &&
        t !== undefined &&
        !(myTournaments ?? []).some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mt: any) => mt.id === (t as TournamentWithOrganizer).id
        )
    )

  const typedMyTournaments = (myTournaments ?? []) as unknown as TournamentWithOrganizer[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedMyMatches = (myMatches ?? []) as unknown as any[]

  const wins = profile?.wins ?? 0
  const losses = profile?.losses ?? 0
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title">Dashboard</h1>
        <Link href="/tournaments/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Tournament
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-center">
          <p className="text-2xl font-extrabold text-brand-500">{wins}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Wins</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-center">
          <p className="text-2xl font-extrabold text-red-500">{losses}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Losses</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-center">
          {winRate !== null ? (
            <>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center justify-center gap-1">
                <TrendingUp className="h-5 w-5 text-brand-500" />
                {winRate}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Win rate</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-extrabold text-gray-400">—</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Win rate</p>
            </>
          )}
        </div>
      </div>

      {/* My Matches */}
      {typedMyMatches.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Swords className="h-4 w-4 text-brand-500" />
            My Matches ({typedMyMatches.length})
          </h2>
          <div className="flex flex-col gap-2">
            {typedMyMatches.map((m) => {
              const isP1 = m.player1_id === user!.id
              const opponentName = isP1
                ? (m.player2_name ?? 'TBD')
                : (m.player1_name ?? 'TBD')
              const tournamentTitle = m.tournaments?.title ?? 'Tournament'
              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 hover:border-brand-400 dark:hover:border-brand-600 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{tournamentTitle}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Match #{m.match_number} · vs {opponentName}
                    </p>
                  </div>
                  <MatchStatusBadge status={m.status} />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* My Tournaments */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-brand-500" />
          Tournaments I Organize ({typedMyTournaments.length})
        </h2>
        {typedMyTournaments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {typedMyTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <p className="text-gray-400 dark:text-gray-500 mb-4">
              You haven&apos;t created any tournaments yet.
            </p>
            <Link href="/tournaments/new">
              <Button variant="secondary">
                <Plus className="h-4 w-4" />
                Create your first tournament
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* Joined */}
      {joinedTournaments.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Tournaments I&apos;m In ({joinedTournaments.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {joinedTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
