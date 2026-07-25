import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkSuperAdmin } from '@/lib/admin-guard'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Writes a player into one slot of a downstream match, then opens that match
 * only if BOTH slots are now filled — otherwise the player who arrived first
 * sees a playable match against an empty slot and can submit a result for it.
 */
async function advanceInto(
  admin: AdminClient,
  matchId: string,
  slot: number,
  playerId: string | null,
  playerName: string | null
) {
  const idField = slot === 1 ? 'player1_id' : 'player2_id'
  const nameField = slot === 1 ? 'player1_name' : 'player2_name'

  await admin
    .from('matches')
    .update({ [idField]: playerId ?? null, [nameField]: playerName ?? null })
    .eq('id', matchId)

  const { data: next } = await admin
    .from('matches')
    .select('player1_id, player1_name, player2_id, player2_name, status')
    .eq('id', matchId)
    .single()

  if (!next || next.status === 'completed' || next.status === 'walkover') return

  const hasP1 = next.player1_id !== null || next.player1_name !== null
  const hasP2 = next.player2_id !== null || next.player2_name !== null
  if (hasP1 && hasP2) {
    await admin.from('matches').update({ status: 'scheduled' }).eq('id', matchId)
  }
}

// POST /api/matches/[id]/walkover
// Organizer-only: mark a match as walkover, set winner by slot (1 or 2), advance bracket.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { winner_slot } = body
  if (winner_slot !== 1 && winner_slot !== 2) {
    return NextResponse.json({ error: 'winner_slot must be 1 or 2' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, player1_id, player1_name, player2_id, player2_name, status, next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot, tie_id, leg, tournament_id, group_name, bracket')
    .eq('id', params.id)
    .single()

  if (matchErr || !match) {
    return NextResponse.json({ error: matchErr?.message ?? 'Match not found' }, { status: 404 })
  }

  const { data: tournament, error: tournamentErr } = await admin
    .from('tournaments')
    .select('organizer_id, format')
    .eq('id', match.tournament_id)
    .single()

  if (tournamentErr || !tournament) {
    return NextResponse.json({ error: tournamentErr?.message ?? 'Tournament not found' }, { status: 404 })
  }

  const superAdmin = await checkSuperAdmin(user.id)
  if (tournament.organizer_id !== user.id && !superAdmin) {
    return NextResponse.json({ error: 'Only the organizer can declare a walkover' }, { status: 403 })
  }

  if (!['scheduled', 'pending'].includes(match.status)) {
    return NextResponse.json({ error: 'Match cannot be walked over in its current state' }, { status: 409 })
  }

  const winner_id = winner_slot === 1 ? match.player1_id : match.player2_id
  const winner_name = winner_slot === 1 ? match.player1_name : match.player2_name

  // The chosen side must actually hold a player, or we'd mark the match decided
  // with a null winner and push a ghost into the next round.
  if (winner_id === null && winner_name === null) {
    return NextResponse.json(
      { error: 'That side has no player yet — a walkover needs a known winner' },
      { status: 409 }
    )
  }

  // Record a forfeit scoreline (football convention: 3-0). Without scores a
  // walkover reads as 0-0 to every score-based standings table — handing the
  // player who forfeited a point — and for guest players (null ids) the winner
  // would not be recoverable from the row at all.
  const winnerScore = 3
  const loserScore = 0
  const forfeitScores =
    winner_slot === 1
      ? { player1_score: winnerScore, player2_score: loserScore }
      : { player1_score: loserScore, player2_score: winnerScore }

  await admin
    .from('matches')
    .update({ winner_id, ...forfeitScores, status: 'walkover', played_at: new Date().toISOString() })
    .eq('id', params.id)

  // Handle home_away_knockout / group_knockout: if this is leg 1 of a tie, mark leg 2 as walkover too
  if ((tournament.format === 'home_away_knockout' || tournament.format === 'group_knockout') && match.tie_id && match.leg === 1) {
    const { data: leg2 } = await admin
      .from('matches')
      .select('id, player1_id, player2_id')
      .eq('tie_id', match.tie_id)
      .eq('leg', 2)
      .single()

    if (leg2) {
      // In leg2 players are swapped: leg1.player1 → leg2.player2
      const leg2WinnerSlot = winner_slot === 1 ? 'player2' : 'player1'
      const leg2Scores =
        leg2WinnerSlot === 'player1'
          ? { player1_score: winnerScore, player2_score: loserScore }
          : { player1_score: loserScore, player2_score: winnerScore }

      await admin.from('matches').update({
        winner_id,
        ...leg2Scores,
        status: 'walkover',
        [`${leg2WinnerSlot}_id`]: winner_id,
        [`${leg2WinnerSlot}_name`]: winner_name,
        played_at: new Date().toISOString(),
      }).eq('id', leg2.id)

      // Both legs are now decided, so the tie is over — advance from leg 2, which
      // is the leg that carries next_match_id/slot for the next round. Walking
      // over leg 1 alone previously left the next round's slot empty forever.
      const { data: leg2Full } = await admin
        .from('matches')
        .select('next_match_id, next_match_slot')
        .eq('id', leg2.id)
        .single()

      if (leg2Full?.next_match_id && leg2Full.next_match_slot) {
        await advanceInto(admin, leg2Full.next_match_id, leg2Full.next_match_slot, winner_id, winner_name)
      }
    }
  }

  // Advance winner to next match. Skipped for leg 1 of a two-legged tie, whose
  // next_match_id points at leg 2 (already handled above).
  const isTwoLeggedLeg1 =
    (tournament.format === 'home_away_knockout' || tournament.format === 'group_knockout') &&
    !!match.tie_id &&
    match.leg === 1

  if (!isTwoLeggedLeg1 && match.next_match_id && match.next_match_slot) {
    await advanceInto(admin, match.next_match_id, match.next_match_slot, winner_id, winner_name)
  }

  // Double elimination: the forfeiting player still drops to the losers bracket.
  if (tournament.format === 'double_elimination' && match.bracket === 'winners' && match.loser_next_match_id && match.loser_next_match_slot) {
    const loser_id = winner_slot === 1 ? match.player2_id : match.player1_id
    const loser_name = winner_slot === 1 ? match.player2_name : match.player1_name
    await advanceInto(admin, match.loser_next_match_id, match.loser_next_match_slot, loser_id, loser_name)
  }

  // Check tournament completion
  if (!match.next_match_id) {
    const fmt = tournament.format
    let checkRemaining = false

    if (fmt === 'knockout' || fmt === 'home_away_knockout' || fmt === 'double_elimination') {
      checkRemaining = true
    } else if (fmt === 'group_knockout' && !match.group_name) {
      checkRemaining = true
    } else if (fmt === 'champions_league' && !match.group_name && !match.bracket) {
      // CL league-phase matches have bracket='league' and no group_name; treating
      // them as knockout matches would end the tournament before the playoff and
      // knockout stages have even been generated. Only the true knockout final
      // (no bracket) can complete it — same rule finalizeMatch uses.
      checkRemaining = true
    } else if (fmt === 'round_robin' || fmt === 'league') {
      checkRemaining = true
    }

    if (checkRemaining) {
      const { data: remaining } = await admin
        .from('matches')
        .select('id')
        .eq('tournament_id', match.tournament_id)
        .neq('status', 'completed')
        .neq('status', 'walkover')
        .limit(1)

      if (!remaining || remaining.length === 0) {
        await admin.from('tournaments').update({ status: 'completed' }).eq('id', match.tournament_id)
      }
    }
  }

  return NextResponse.json({ status: 'walkover', winner_id })
}
