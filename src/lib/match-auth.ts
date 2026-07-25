import { createAdminClient } from '@/lib/supabase/admin'
import { checkSuperAdmin } from '@/lib/admin-guard'

type AdminClient = ReturnType<typeof createAdminClient>

export interface MatchActor {
  /** Storage path prefix / identity slug for this caller. */
  slug: string
  /** True when the caller is one of the two players in the match. */
  isPlayer: boolean
  /** True when the caller runs the tournament (organizer or super admin). */
  isOrganizer: boolean
}

export type MatchAuthResult =
  | { ok: true; actor: MatchActor; match: MatchRow }
  | { ok: false; status: number; error: string }

export interface MatchRow {
  id: string
  tournament_id: string
  player1_id: string | null
  player1_name: string | null
  player2_id: string | null
  player2_name: string | null
  status: string
}

/**
 * Verifies that the caller is allowed to act on a specific match, and returns
 * the match row so callers don't have to re-fetch it.
 *
 * Registered users must be one of the two players, the organizer, or a super
 * admin. Guests present an `X-Participant-Id` header; that participant must
 * belong to *this match's tournament* (a participant id from another tournament
 * is rejected even if the nametag happens to match) and be one of the two named
 * players.
 *
 * Every caller here uses the service-role client, which bypasses row-level
 * security — so this check is the only thing standing between a request and
 * someone else's match. Do not skip it.
 */
export async function authorizeMatchActor(
  admin: AdminClient,
  matchId: string,
  user: { id: string } | null,
  participantIdHeader: string | null
): Promise<MatchAuthResult> {
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, tournament_id, player1_id, player1_name, player2_id, player2_name, status')
    .eq('id', matchId)
    .single()

  if (matchErr || !match) {
    return { ok: false, status: matchErr && matchErr.code !== 'PGRST116' ? 500 : 404, error: matchErr?.message ?? 'Match not found' }
  }

  const typedMatch = match as MatchRow

  if (user) {
    const isPlayer = typedMatch.player1_id === user.id || typedMatch.player2_id === user.id

    const { data: tournament } = await admin
      .from('tournaments')
      .select('organizer_id')
      .eq('id', typedMatch.tournament_id)
      .single()

    let isOrganizer = tournament?.organizer_id === user.id
    if (!isPlayer && !isOrganizer) {
      isOrganizer = await checkSuperAdmin(user.id)
    }

    if (!isPlayer && !isOrganizer) {
      return { ok: false, status: 403, error: 'You are not a participant in this match' }
    }

    return { ok: true, actor: { slug: user.id, isPlayer, isOrganizer }, match: typedMatch }
  }

  if (!participantIdHeader) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const { data: participant, error: participantErr } = await admin
    .from('participants')
    .select('id, name, tournament_id')
    .eq('id', participantIdHeader)
    .single()

  if (participantErr || !participant?.name) {
    return {
      ok: false,
      status: participantErr && participantErr.code !== 'PGRST116' ? 500 : 401,
      error: participantErr?.message ?? 'Unauthorized',
    }
  }

  // A participant id only grants access within its own tournament.
  if (participant.tournament_id !== typedMatch.tournament_id) {
    return { ok: false, status: 403, error: 'You are not a participant in this match' }
  }

  // Match on a GUEST slot only. A registered player's slot also carries a display
  // name, so without the null-id requirement a guest who picked the same nametag
  // could act on that player's match (nothing enforces unique names).
  const ownsSlot1 = typedMatch.player1_id === null && typedMatch.player1_name === participant.name
  const ownsSlot2 = typedMatch.player2_id === null && typedMatch.player2_name === participant.name

  if (!ownsSlot1 && !ownsSlot2) {
    return { ok: false, status: 403, error: 'You are not a participant in this match' }
  }

  return { ok: true, actor: { slug: participant.id as string, isPlayer: true, isOrganizer: false }, match: typedMatch }
}
