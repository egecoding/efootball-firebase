import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlayerPortal } from '@/components/tournament/PlayerPortal'
import type {
  TournamentWithOrganizer,
  ParticipantWithProfile,
  RoundWithMatches,
  Profile,
} from '@/types/database'

interface PageProps {
  params: { id: string }
}

export default async function PlayerPortalPage({ params }: PageProps) {
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

  // Build profile map for bracket/schedule display
  const profileMap: Record<
    string,
    Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
  > = {}
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

  // For logged-in users, find their participant_id from the DB
  const userParticipantId = user
    ? (participants ?? []).find((p) => p.user_id === user.id)?.id ?? null
    : null

  return (
    <PlayerPortal
      tournament={typedTournament}
      participants={(participants as unknown as ParticipantWithProfile[]) ?? []}
      rounds={(rounds as unknown as RoundWithMatches[]) ?? []}
      profileMap={profileMap}
      currentUserId={user?.id ?? null}
      userParticipantId={userParticipantId}
      tournamentId={params.id}
    />
  )
}
