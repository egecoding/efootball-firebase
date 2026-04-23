import Link from 'next/link'
import { Plus, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import { Button } from '@/components/ui/Button'
import type { TournamentWithOrganizer } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: myTournaments }, { data: joined }] = await Promise.all([
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

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <h1 className="section-title">Dashboard</h1>
        <Link href="/tournaments/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Tournament
          </Button>
        </Link>
      </div>

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
