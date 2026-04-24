import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Users, Calendar, Trophy, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { BracketView } from '@/components/tournament/BracketView'
import { ScheduleView } from '@/components/tournament/ScheduleView'
import { StandingsTable } from '@/components/tournament/StandingsTable'
import { ParticipantList } from '@/components/tournament/ParticipantList'
import type { TournamentWithOrganizer, ParticipantWithProfile, RoundWithMatches, MatchWithPlayers, Profile } from '@/types/database'

interface PageProps {
  params: { id: string }
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: tournament }, { data: participants }, { data: rounds }] =
    await Promise.all([
      supabase
        .from('tournaments')
        .select(
          'id, organizer_id, title, description, game_name, max_participants, status, format, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
        )
        .eq('id', params.id)
        .single(),
      supabase
        .from('participants')
        .select(
          'id, tournament_id, user_id, name, seed, joined_at, profiles(id, username, display_name, avatar_url, wins, losses, created_at, updated_at)'
        )
        .eq('tournament_id', params.id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('rounds')
        .select(
          'id, tournament_id, round_number, round_name, matches(id, tournament_id, round_id, match_number, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, winner_id, status, screenshot_url, submitted_by, next_match_id, next_match_slot, played_at, created_at, updated_at)'
        )
        .eq('tournament_id', params.id)
        .order('round_number', { ascending: true }),
    ])

  if (!tournament) notFound()

  const typedTournament = tournament as unknown as TournamentWithOrganizer
  const organizer = typedTournament.profiles
  const isOrganizer = user?.id === tournament.organizer_id
  const isParticipant = participants?.some((p) => p.user_id === user?.id)

  // Build a profile map from participants for use in BracketView
  const profileMap: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>> = {}
  if (participants) {
    for (const p of participants) {
      if (p.profiles && p.user_id) {
        const prof = p.profiles as unknown as Profile
        profileMap[p.user_id] = {
          id: prof.id,
          username: prof.username,
          display_name: prof.display_name,
          avatar_url: prof.avatar_url,
        }
      }
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="section-title">{tournament.title}</h1>
              <TournamentStatusBadge status={tournament.status} />
            </div>
            {tournament.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                {tournament.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                {tournament.game_name}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {participants?.length ?? 0} / {tournament.max_participants} players
              </span>
              {tournament.starts_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(tournament.starts_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOrganizer && (
              <Link
                href={`/tournaments/${params.id}/manage`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Manage
              </Link>
            )}
            {!isParticipant && !isOrganizer && tournament.status === 'open' && user && (
              <Link
                href={`/tournaments/${params.id}/join`}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                Join Tournament
              </Link>
            )}
          </div>
        </div>

        {/* Organizer */}
        <div className="flex items-center gap-2 mt-4">
          <Avatar
            src={organizer?.avatar_url}
            name={organizer?.display_name ?? organizer?.username}
            size="sm"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Organized by{' '}
            <Link
              href={`/profile/${organizer?.id}`}
              className="font-medium text-gray-700 dark:text-gray-300 hover:text-brand-500"
            >
              {organizer?.display_name ?? organizer?.username}
            </Link>
          </span>
        </div>
      </div>

      {/* Bracket / Schedule */}
      {rounds && rounds.length > 0 ? (
        <div className="mb-10">
          {(typedTournament as unknown as { format?: string }).format === 'knockout' || !(typedTournament as unknown as { format?: string }).format ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bracket</h2>
              <BracketView
                rounds={rounds as unknown as RoundWithMatches[]}
                currentUserId={user?.id}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
              />
            </>
          ) : (
            <>
              {/* Standings */}
              {participants && participants.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Standings</h2>
                  <StandingsTable
                    matches={(rounds as unknown as RoundWithMatches[]).flatMap((r) => r.matches) as unknown as MatchWithPlayers[]}
                    participants={participants as unknown as ParticipantWithProfile[]}
                    format={(typedTournament as unknown as { format?: string }).format as 'round_robin' | 'league'}
                  />
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule</h2>
              <ScheduleView
                rounds={rounds as unknown as RoundWithMatches[]}
                currentUserId={user?.id}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
              />
            </>
          )}
        </div>
      ) : (
        tournament.status === 'open' && (
          <div className="mb-10 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <p className="text-gray-400 dark:text-gray-500">
              {(typedTournament as unknown as { format?: string }).format === 'knockout' || !(typedTournament as unknown as { format?: string }).format
                ? 'Bracket will appear once the organizer starts the tournament.'
                : 'Schedule will appear once the organizer starts the tournament.'}
            </p>
          </div>
        )
      )}

      {/* Participants */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Participants ({participants?.length ?? 0})
        </h2>
        <ParticipantList
          participants={(participants as unknown as ParticipantWithProfile[]) ?? []}
          organizerId={tournament.organizer_id}
          currentUserId={user?.id}
          tournamentId={params.id}
        />
      </div>
    </div>
  )
}
