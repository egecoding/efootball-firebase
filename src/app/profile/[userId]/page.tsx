import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/Avatar'
import { StatsCard } from '@/components/profile/StatsCard'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import type { Profile, TournamentWithOrganizer } from '@/types/database'
import { Calendar } from 'lucide-react'

interface PageProps {
  params: { userId: string }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, wins, losses, created_at, updated_at')
    .eq('id', params.userId)
    .single()

  if (!profile) notFound()

  const typedProfile = profile as unknown as Profile

  const { data: participations } = await supabase
    .from('participants')
    .select(
      'tournament_id, tournaments(id, organizer_id, title, description, game_name, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url))'
    )
    .eq('user_id', params.userId)
    .order('joined_at', { ascending: false })
    .limit(10)

  const tournaments: TournamentWithOrganizer[] = (participations ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => p.tournaments)
    .filter(
      (t: unknown): t is TournamentWithOrganizer =>
        t !== null && t !== undefined && (t as TournamentWithOrganizer).is_public
    )

  return (
    <div className="page-container">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
          <div className="flex items-center gap-5">
            <Avatar
              src={typedProfile.avatar_url}
              name={typedProfile.display_name ?? typedProfile.username}
              size="xl"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {typedProfile.display_name ?? typedProfile.username}
              </h1>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                @{typedProfile.username}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-2">
                <Calendar className="h-3.5 w-3.5" />
                Joined {new Date(typedProfile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <StatsCard profile={typedProfile} />
        </div>

        {tournaments.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Tournaments
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tournaments.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
