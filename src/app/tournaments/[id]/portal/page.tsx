import { redirect } from 'next/navigation'
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

  // Try to use admin client (requires SUPABASE_SERVICE_ROLE_KEY).
  // If the key is missing (e.g. not yet set on Vercel), fall back to the
  // regular tournament page rather than crashing to a 404.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    admin = createAdminClient()
  } catch {
    redirect(`/tournaments/${params.id}`)
  }

  let tournament: unknown = null
  let participants: unknown[] = []
  let rounds: unknown[] = []

  try {
    const [t, p, r] = await Promise.all([
      admin
        .from('tournaments')
        .select(
          'id, organizer_id, title, description, game_name, max_participants, status, format, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
        )
        .eq('id', params.id)
        .single(),
      admin
        .from('participants')
        .select(
          'id, tournament_id, user_id, name, seed, joined_at, profiles(id, username, display_name, avatar_url, wins, losses, created_at, updated_at)'
        )
        .eq('tournament_id', params.id)
        .order('joined_at', { ascending: true }),
      admin
        .from('rounds')
        .select(
          'id, tournament_id, round_number, round_name, matches(id, tournament_id, round_id, match_number, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, winner_id, status, screenshot_url, submitted_by, next_match_id, next_match_slot, played_at, created_at, updated_at)'
        )
        .eq('tournament_id', params.id)
        .order('round_number', { ascending: true }),
    ])
    tournament = t.data
    participants = p.data ?? []
    rounds = r.data ?? []
  } catch {
    redirect(`/tournaments/${params.id}`)
  }

  if (!tournament) redirect(`/tournaments/${params.id}`)

  const typedTournament = tournament as unknown as TournamentWithOrganizer

  const profileMap: Record<
    string,
    Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
  > = {}
  for (const p of participants as ParticipantWithProfile[]) {
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

  const userParticipantId = user
    ? (participants as ParticipantWithProfile[]).find((p) => p.user_id === user.id)?.id ?? null
    : null

  return (
    <PlayerPortal
      tournament={typedTournament}
      participants={participants as ParticipantWithProfile[]}
      rounds={rounds as RoundWithMatches[]}
      profileMap={profileMap}
      currentUserId={user?.id ?? null}
      userParticipantId={userParticipantId}
      tournamentId={params.id}
    />
  )
}
