import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendPush, sendPushToParticipants } from '@/lib/push'
import { checkSuperAdmin } from '@/lib/admin-guard'
import { isDrawAllowed } from '@/lib/match-finalize'

type AdminClient = ReturnType<typeof createAdminClient>

// Statuses that mean "someone already played this match" — a downstream match in
// any of these can't have its players swapped out from under it.
const PLAYED_STATUSES = ['completed', 'walkover', 'awaiting_confirmation']

/**
 * Finds a downstream match that already consumed this match's winner (or loser)
 * and has since been played. Returns its match_number, or null if it's safe to
 * rewrite the downstream slots.
 */
async function findBlockingDownstreamMatch(
  admin: AdminClient,
  format: string,
  match: {
    next_match_id: string | null
    loser_next_match_id: string | null
    bracket: string | null
    tie_id: string | null
    leg: number | null
  }
): Promise<number | null> {
  const idsToCheck: string[] = []

  if (match.next_match_id) idsToCheck.push(match.next_match_id)
  if (format === 'double_elimination' && match.bracket === 'winners' && match.loser_next_match_id) {
    idsToCheck.push(match.loser_next_match_id)
  }

  // Two-legged ties: the sibling leg of this same tie also depends on the result
  // (leg 2 is unlocked by leg 1, and leg 2's aggregate decides who advances).
  if (match.tie_id) {
    const { data: siblings } = await admin
      .from('matches')
      .select('id, leg')
      .eq('tie_id', match.tie_id)
    for (const s of siblings ?? []) {
      if (s.id && s.leg !== match.leg) idsToCheck.push(s.id as string)
    }
  }

  if (idsToCheck.length === 0) return null

  const { data: downstream } = await admin
    .from('matches')
    .select('match_number, status')
    .in('id', idsToCheck)

  for (const d of downstream ?? []) {
    if (PLAYED_STATUSES.includes(d.status as string)) {
      return d.match_number as number
    }
  }

  return null
}

// POST /api/matches/[id]/correct
// Organizer/super-admin only: fixes the score (and possibly the winner) of a
// match that is already completed — e.g. when the AI misread a screenshot.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, match_number, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, winner_id, status, next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot, bracket, group_name, tie_id, leg, tournament_id')
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
    return NextResponse.json({ error: 'Only the organizer can correct results' }, { status: 403 })
  }

  if (!['completed', 'walkover'].includes(match.status)) {
    return NextResponse.json(
      { error: 'Only a finalized match can be corrected. Use the confirm flow for matches still awaiting a result.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { player1_score, player2_score, reason } = body

  if (!Number.isInteger(player1_score) || !Number.isInteger(player2_score)) {
    return NextResponse.json({ error: 'player1_score and player2_score must be whole numbers' }, { status: 400 })
  }
  if (player1_score < 0 || player2_score < 0) {
    return NextResponse.json({ error: 'Scores must be non-negative' }, { status: 400 })
  }

  if (player1_score === player2_score && !isDrawAllowed(tournament.format, match)) {
    return NextResponse.json({ error: 'Cannot set a draw in a knockout match' }, { status: 400 })
  }

  const isDraw = player1_score === player2_score
  const newWinnerId = isDraw ? null : player1_score > player2_score ? match.player1_id : match.player2_id
  const newLoserId = isDraw ? null : player1_score > player2_score ? match.player2_id : match.player1_id
  const newWinnerName = isDraw ? null : player1_score > player2_score ? match.player1_name : match.player2_name

  const oldWinnerId = match.winner_id

  // Compare which SIDE won, not which id: guests have a null player id, so an
  // id comparison reports "unchanged" for every guest-vs-guest correction and
  // silently leaves the eliminated player in the bracket.
  const newWinnerSide: 1 | 2 | null = isDraw ? null : player1_score > player2_score ? 1 : 2

  let oldWinnerSide: 1 | 2 | null = null
  if (
    match.player1_score !== null &&
    match.player2_score !== null &&
    match.player1_score !== match.player2_score
  ) {
    oldWinnerSide = match.player1_score > match.player2_score ? 1 : 2
  } else if (oldWinnerId) {
    // Walkovers carry a winner_id but no scores.
    oldWinnerSide = oldWinnerId === match.player1_id ? 1 : 2
  }

  const winnerChanged = newWinnerSide !== oldWinnerSide

  // ── Cascade safety gate ────────────────────────────────────────────────────
  // A score-only fix (same winner) never disturbs the bracket. But if the winner
  // flips, anything downstream that already played with the old winner would be
  // left inconsistent — refuse rather than silently corrupt the bracket.
  if (winnerChanged) {
    const blockingMatchNumber = await findBlockingDownstreamMatch(admin, tournament.format, match)
    if (blockingMatchNumber !== null) {
      return NextResponse.json(
        {
          error: `This correction would change the winner, but match #${blockingMatchNumber} has already been played with the current winner. Correct or void match #${blockingMatchNumber} first.`,
        },
        { status: 409 }
      )
    }
  }

  // ── Apply the correction ───────────────────────────────────────────────────
  const { error: updateErr } = await admin
    .from('matches')
    .update({
      player1_score,
      player2_score,
      winner_id: newWinnerId,
      // The complaint (if any) is now resolved
      disputed: false,
      dispute_reason: null,
    })
    .eq('id', params.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Reconcile win/loss counts. These must be derived from the OLD SCORES, not from
  // winner_id: stats are only ever incremented alongside a score (see finalizeMatch),
  // whereas a walkover sets winner_id with no scores and no increments. Deriving from
  // scores is therefore the only way to know what was actually counted.
  // Guests have no profile row, so their ids are null and get skipped.
  let priorWinnerId: string | null = null
  let priorLoserId: string | null = null
  if (
    match.player1_score !== null &&
    match.player2_score !== null &&
    match.player1_score !== match.player2_score
  ) {
    const p1HadWon = match.player1_score > match.player2_score
    priorWinnerId = p1HadWon ? match.player1_id : match.player2_id
    priorLoserId = p1HadWon ? match.player2_id : match.player1_id
  }

  if (priorWinnerId !== newWinnerId || priorLoserId !== newLoserId) {
    if (priorWinnerId) await admin.rpc('decrement_wins', { uid: priorWinnerId })
    if (priorLoserId) await admin.rpc('decrement_losses', { uid: priorLoserId })
    if (newWinnerId) await admin.rpc('increment_wins', { uid: newWinnerId })
    if (newLoserId) await admin.rpc('increment_losses', { uid: newLoserId })
  }

  // Re-point downstream slots at the new winner (safe: the gate above proved
  // nothing downstream has been played yet)
  if (winnerChanged) {
    if (match.next_match_id && match.next_match_slot) {
      const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
      const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'
      await admin
        .from('matches')
        .update({ [idField]: newWinnerId ?? null, [nameField]: newWinnerName ?? null })
        .eq('id', match.next_match_id)
    }

    if (
      tournament.format === 'double_elimination' &&
      match.bracket === 'winners' &&
      match.loser_next_match_id &&
      match.loser_next_match_slot
    ) {
      const newLoserName = isDraw
        ? null
        : player1_score > player2_score ? match.player2_name : match.player1_name
      const lIdField = match.loser_next_match_slot === 1 ? 'player1_id' : 'player2_id'
      const lNameField = match.loser_next_match_slot === 1 ? 'player1_name' : 'player2_name'
      await admin
        .from('matches')
        .update({ [lIdField]: newLoserId ?? null, [lNameField]: newLoserName ?? null })
        .eq('id', match.loser_next_match_id)
    }
  }

  // ── Audit trail ────────────────────────────────────────────────────────────
  await admin.from('match_corrections').insert({
    match_id: params.id,
    corrected_by: user.id,
    old_player1_score: match.player1_score,
    old_player2_score: match.player2_score,
    old_winner_id: oldWinnerId,
    new_player1_score: player1_score,
    new_player2_score: player2_score,
    new_winner_id: newWinnerId,
    reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
  })

  // ── Notify both sides ──────────────────────────────────────────────────────
  const scoreStr = `${player1_score} – ${player2_score}`
  const { data: guestParticipants } = await admin
    .from('participants')
    .select('id, name')
    .eq('tournament_id', match.tournament_id)
    .is('user_id', null)

  const guestIdByName = Object.fromEntries(
    (guestParticipants ?? []).map((p) => [p.name, p.id])
  )

  sendPush([match.player1_id, match.player2_id], {
    title: '✏️ Result corrected',
    body: `The organizer updated your match result to ${scoreStr}.`,
    url: `/matches/${params.id}`,
  })

  const p1GuestId = !match.player1_id && match.player1_name ? guestIdByName[match.player1_name] : null
  const p2GuestId = !match.player2_id && match.player2_name ? guestIdByName[match.player2_name] : null
  const guestIds = [p1GuestId, p2GuestId].filter(Boolean) as string[]
  if (guestIds.length > 0) {
    sendPushToParticipants(guestIds, {
      title: '✏️ Result corrected',
      body: `The organizer updated your match result to ${scoreStr}.`,
      url: `/tournaments/${match.tournament_id}/portal`,
    })
  }

  return NextResponse.json({ status: 'corrected', winner_id: newWinnerId, winner_changed: winnerChanged })
}
