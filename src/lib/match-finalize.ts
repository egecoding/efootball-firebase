import { sendPush, sendPushToParticipants } from '@/lib/push'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type FinalizeResult =
  | { ok: true; winnerId: string | null }
  | { ok: false; status: number; error: string }

/** Match fields the draw rule depends on. */
export interface DrawRuleMatch {
  bracket: string | null
  group_name: string | null
  tie_id: string | null
}

// Whether a draw is legal for this match. Knockout ties must produce a winner,
// except individual legs of a two-legged tie (the aggregate decides those).
export function isDrawAllowed(format: string, match: DrawRuleMatch): boolean {
  const isKnockoutPhase =
    format === 'knockout' ||
    format === 'double_elimination' ||
    (format === 'home_away_knockout' && !match.tie_id) || // single-leg Final only
    (format === 'group_knockout' && !match.group_name && !match.tie_id) || // single-leg final
    (format === 'champions_league' && match.bracket !== 'league') // playoff + KO rounds

  // Two-legged ties (group_knockout / home_away_knockout) allow draws per leg — aggregate decides
  const isTwoLeggedLeg =
    (format === 'group_knockout' || format === 'home_away_knockout') &&
    match.tie_id !== null &&
    match.tie_id !== undefined

  return !isKnockoutPhase || isTwoLeggedLeg
}

// Finalizes a match: computes winner/loser, marks it completed, increments
// win/loss counts, notifies both sides, advances the bracket (including
// two-legged tie aggregation and double-elimination loser routing), and
// detects tournament completion. Used by both the organizer's manual
// "Confirm Result" action and high-confidence AI score reads.
export async function finalizeMatch(
  admin: AdminClient,
  matchId: string,
  {
    player1Score,
    player2Score,
    submittedBy,
    screenshotUrl,
  }: {
    player1Score: number
    player2Score: number
    submittedBy: string | null
    /** Attach evidence to the match row. Omit to leave any existing value alone. */
    screenshotUrl?: string | null
  }
): Promise<FinalizeResult> {
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, status, next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot, bracket, group_name, tie_id, leg, tournament_id, screenshot_url')
    .eq('id', matchId)
    .single()

  if (matchErr || !match) {
    return { ok: false, status: 404, error: matchErr?.message ?? 'Match not found' }
  }

  const { data: tournament, error: tournamentErr } = await admin
    .from('tournaments')
    .select('organizer_id, format')
    .eq('id', match.tournament_id)
    .single()

  if (tournamentErr || !tournament) {
    return { ok: false, status: 404, error: tournamentErr?.message ?? 'Tournament not found' }
  }

  if (!['scheduled', 'awaiting_confirmation'].includes(match.status)) {
    return { ok: false, status: 409, error: 'Match cannot be confirmed in its current state' }
  }

  const p1Score = player1Score
  const p2Score = player2Score

  if (p1Score === p2Score && !isDrawAllowed(tournament.format, match)) {
    return { ok: false, status: 400, error: 'Cannot confirm a draw in a knockout match' }
  }

  const isDraw = p1Score === p2Score
  const winner_id = isDraw ? null : p1Score > p2Score ? match.player1_id : match.player2_id
  const loser_id = isDraw ? null : p1Score > p2Score ? match.player2_id : match.player1_id

  // Re-assert the status in the WHERE clause so two concurrent finalizes (an
  // organizer double-click, or a retry) can't both win: the second matches zero
  // rows and bails out before double-counting stats or re-advancing the bracket.
  const { data: updatedRows, error: updateErr } = await admin
    .from('matches')
    .update({
      player1_score: p1Score,
      player2_score: p2Score,
      winner_id,
      status: 'completed',
      submitted_by: submittedBy,
      played_at: new Date().toISOString(),
      ...(screenshotUrl !== undefined ? { screenshot_url: screenshotUrl } : {}),
    })
    .eq('id', matchId)
    .eq('status', match.status)
    .select('id')

  if (updateErr) {
    return { ok: false, status: 500, error: updateErr.message }
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, status: 409, error: 'This match was already finalized' }
  }

  if (winner_id) await admin.rpc('increment_wins', { uid: winner_id })
  if (loser_id) await admin.rpc('increment_losses', { uid: loser_id })

  // Notify both players their result has been confirmed (registered + guest)
  const scoreStr = `${p1Score} – ${p2Score}`

  // Look up guest participant IDs by name for this tournament
  const { data: guestParticipants } = await admin
    .from('participants')
    .select('id, name')
    .eq('tournament_id', match.tournament_id)
    .is('user_id', null)

  const guestIdByName = Object.fromEntries(
    (guestParticipants ?? []).map((p) => [p.name, p.id])
  )

  const p1GuestId = !match.player1_id && match.player1_name ? guestIdByName[match.player1_name] : null
  const p2GuestId = !match.player2_id && match.player2_name ? guestIdByName[match.player2_name] : null

  sendPush([match.player1_id], {
    title: '✅ Result confirmed',
    body: isDraw
      ? `Your match ended ${scoreStr} (draw)`
      : match.player1_id === winner_id
        ? `You won ${scoreStr} 🏆`
        : `You lost ${scoreStr}`,
    url: `/matches/${matchId}`,
  })
  sendPush([match.player2_id], {
    title: '✅ Result confirmed',
    body: isDraw
      ? `Your match ended ${scoreStr} (draw)`
      : match.player2_id === winner_id
        ? `You won ${scoreStr} 🏆`
        : `You lost ${scoreStr}`,
    url: `/matches/${matchId}`,
  })
  if (p1GuestId) sendPushToParticipants([p1GuestId], {
    title: '✅ Result confirmed',
    body: isDraw ? `Your match ended ${scoreStr} (draw)` : `Match result: ${scoreStr}`,
    url: `/tournaments/${match.tournament_id}/portal`,
  })
  if (p2GuestId) sendPushToParticipants([p2GuestId], {
    title: '✅ Result confirmed',
    body: isDraw ? `Your match ended ${scoreStr} (draw)` : `Match result: ${scoreStr}`,
    url: `/tournaments/${match.tournament_id}/portal`,
  })

  // ── Two-legged tie logic (group_knockout knockout phase) ─────────────────
  // Leg 1 completed → unlock leg 2 (schedule it)
  // Leg 2 completed → aggregate both legs and advance winner
  if ((tournament.format === 'group_knockout' || tournament.format === 'home_away_knockout') && match.tie_id && match.leg === 1) {
    // Leg 1 done — find and schedule leg 2 via tie_id (robust: doesn't rely on next_match_id being set)
    const { data: leg2Match } = await admin.from('matches').select('id').eq('tie_id', match.tie_id).eq('leg', 2).single()
    if (leg2Match) {
      await admin.from('matches').update({ status: 'scheduled' }).eq('id', leg2Match.id)
    } else if (match.next_match_id) {
      // fallback to next_match_id if tie_id lookup fails
      await admin.from('matches').update({ status: 'scheduled' }).eq('id', match.next_match_id)
    }
    return { ok: true, winnerId: winner_id }
  }

  if ((tournament.format === 'group_knockout' || tournament.format === 'home_away_knockout') && match.tie_id && match.leg === 2) {
    // Fetch leg 1 (other match in same tie)
    const { data: leg1 } = await admin
      .from('matches')
      .select('player1_id, player1_name, player2_id, player2_name, player1_score, player2_score')
      .eq('tie_id', match.tie_id)
      .eq('leg', 1)
      .single()

    if (leg1) {
      // Leg 1: p1 is "home team A", p2 is "home team B"
      // Leg 2: home/away swapped — so match.player1 is original team B, match.player2 is original team A
      // Aggregate from team A's perspective: leg1.p1_score + leg2.p2_score
      const teamA_id = leg1.player1_id
      const teamA_name = leg1.player1_name
      const teamB_id = leg1.player2_id
      const teamB_name = leg1.player2_name

      const teamA_agg = (leg1.player1_score ?? 0) + (p2Score) // leg1 p1 goals + leg2 p2 goals
      const teamB_agg = (leg1.player2_score ?? 0) + (p1Score) // leg1 p2 goals + leg2 p1 goals

      let tieWinnerId: string | null = null
      let tieWinnerName: string | null = null

      if (teamA_agg > teamB_agg) {
        tieWinnerId = teamA_id; tieWinnerName = teamA_name
      } else if (teamB_agg > teamA_agg) {
        tieWinnerId = teamB_id; tieWinnerName = teamB_name
      } else {
        // Aggregate draw — away goals: team A's away goals = leg2.p2_score (team A away in leg 2)
        const teamA_away = p2Score
        const teamB_away = leg1.player2_score ?? 0 // team B's away goals = leg1 p2 goals
        if (teamA_away > teamB_away) {
          tieWinnerId = teamA_id; tieWinnerName = teamA_name
        } else if (teamB_away > teamA_away) {
          tieWinnerId = teamB_id; tieWinnerName = teamB_name
        } else {
          // Still level — team A (higher seeded/first group winner) advances
          tieWinnerId = teamA_id; tieWinnerName = teamA_name
        }
      }

      // Advance tie winner to next round's leg 1
      if (match.next_match_id && match.next_match_slot) {
        const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
        const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'
        // Also need to update the swapped slot in leg 2 of next tie — here we only fill leg 1 slot
        const { data: nextLeg1 } = await admin
          .from('matches')
          .select('id, player1_id, player1_name, player2_id, player2_name, tie_id')
          .eq('id', match.next_match_id)
          .single()
        if (nextLeg1) {
          await admin.from('matches')
            .update({ [idField]: tieWinnerId, [nameField]: tieWinnerName })
            .eq('id', match.next_match_id)

          // If next tie has a leg 2, fill the swapped slot there too
          if (nextLeg1.tie_id) {
            const { data: nextLeg2 } = await admin
              .from('matches')
              .select('id')
              .eq('tie_id', nextLeg1.tie_id)
              .eq('leg', 2)
              .single()
            if (nextLeg2) {
              // Leg 2 is home/away swapped, so the winner goes into the OPPOSITE slot
              const swappedSlot = match.next_match_slot === 1 ? 2 : 1
              const swappedIdField = swappedSlot === 1 ? 'player1_id' : 'player2_id'
              const swappedNameField = swappedSlot === 1 ? 'player1_name' : 'player2_name'
              await admin.from('matches')
                .update({ [swappedIdField]: tieWinnerId, [swappedNameField]: tieWinnerName })
                .eq('id', nextLeg2.id)
            }
          }

          // Check if next leg 1 now has both players — if so schedule it
          const { data: updatedNextLeg1 } = await admin
            .from('matches').select('player1_id, player1_name, player2_id, player2_name').eq('id', match.next_match_id).single()
          if (updatedNextLeg1) {
            const hasP1 = updatedNextLeg1.player1_id !== null || updatedNextLeg1.player1_name !== null
            const hasP2 = updatedNextLeg1.player2_id !== null || updatedNextLeg1.player2_name !== null
            if (hasP1 && hasP2) {
              await admin.from('matches').update({ status: 'scheduled' }).eq('id', match.next_match_id)
            }
          }
        }
      }
    }

    // Notifications for tie winner
    // (reuse existing guest notification infrastructure above)
    // We skip the normal next_match_id winner routing below since we handled it above
    return { ok: true, winnerId: winner_id }
  }

  if (match.next_match_id && match.next_match_slot) {
    const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
    const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'
    const winnerName = p1Score > p2Score ? match.player1_name : match.player2_name
    await admin
      .from('matches')
      .update({ [idField]: winner_id ?? null, [nameField]: winnerName ?? null })
      .eq('id', match.next_match_id)

    // Only open the next match once BOTH slots are filled — otherwise the player
    // who advanced first could submit a result against an empty slot.
    const { data: nextMatch } = await admin
      .from('matches')
      .select('player1_id, player2_id, player1_name, player2_name, match_number')
      .eq('id', match.next_match_id)
      .single()

    const nextReady =
      !!nextMatch &&
      (nextMatch.player1_id !== null || nextMatch.player1_name !== null) &&
      (nextMatch.player2_id !== null || nextMatch.player2_name !== null)

    if (nextReady) {
      await admin.from('matches').update({ status: 'scheduled' }).eq('id', match.next_match_id)
    }

    // Notify both players in the next match that it's ready (registered + guest)
    if (nextMatch && nextReady) {
      sendPush([nextMatch.player1_id, nextMatch.player2_id], {
        title: '🎮 Next match ready',
        body: `Your next match (#${nextMatch.match_number}) is scheduled. Good luck!`,
        url: `/matches/${match.next_match_id}`,
      })
      const nm1GuestId = !nextMatch.player1_id && nextMatch.player1_name ? guestIdByName[nextMatch.player1_name] : null
      const nm2GuestId = !nextMatch.player2_id && nextMatch.player2_name ? guestIdByName[nextMatch.player2_name] : null
      if (nm1GuestId || nm2GuestId) {
        sendPushToParticipants([nm1GuestId, nm2GuestId].filter(Boolean) as string[], {
          title: '🎮 Next match ready',
          body: `Your next match (#${nextMatch.match_number}) is scheduled. Good luck!`,
          url: `/tournaments/${match.tournament_id}/portal`,
        })
      }
    }
  }

  // Double elimination: route loser to LB (only for winners-bracket matches)
  if (tournament.format === 'double_elimination' && match.bracket === 'winners' && match.loser_next_match_id) {
    const loser_id = isDraw ? null : winner_id === match.player1_id ? match.player2_id : match.player1_id
    const loserName = isDraw ? null : winner_id === match.player1_id ? match.player2_name : match.player1_name
    const slot = match.loser_next_match_slot as 1 | 2
    const lIdField = slot === 1 ? 'player1_id' : 'player2_id'
    const lNameField = slot === 1 ? 'player1_name' : 'player2_name'
    await admin
      .from('matches')
      .update({ [lIdField]: loser_id ?? null, [lNameField]: loserName ?? null, status: 'scheduled' })
      .eq('id', match.loser_next_match_id)
  }

  // Determine tournament completion
  {
    const fmt = tournament.format
    let allDone = false

    if (fmt === 'knockout') {
      allDone = !match.next_match_id
    } else if (fmt === 'home_away_knockout') {
      allDone = !match.next_match_id && !match.tie_id
    } else if (fmt === 'double_elimination') {
      allDone = match.bracket === 'grand_final'
    } else if (fmt === 'champions_league') {
      // Complete when the knockout final (no next_match_id, bracket is null = knockout phase) is confirmed
      if (!match.bracket && !match.next_match_id) {
        const { data: remaining } = await admin
          .from('matches')
          .select('id')
          .eq('tournament_id', match.tournament_id)
          .neq('status', 'completed')
          .neq('status', 'walkover')
          .limit(1)
        allDone = !remaining || remaining.length === 0
      }
    } else if (fmt === 'group_knockout') {
      // Complete only when a knockout-phase match (no group_name) with no next_match_id is confirmed
      if (!match.group_name && !match.next_match_id) {
        const { data: remaining } = await admin
          .from('matches')
          .select('id')
          .eq('tournament_id', match.tournament_id)
          .neq('status', 'completed')
          .neq('status', 'walkover')
          .limit(1)
        allDone = !remaining || remaining.length === 0
      }
    } else {
      // round_robin / league: all matches completed or walkover
      if (!match.next_match_id) {
        const { data: remaining } = await admin
          .from('matches')
          .select('id')
          .eq('tournament_id', match.tournament_id)
          .neq('status', 'completed')
          .neq('status', 'walkover')
          .limit(1)
        allDone = !remaining || remaining.length === 0
      }
    }

    if (allDone) {
      await admin
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', match.tournament_id)
    }
  }

  return { ok: true, winnerId: winner_id }
}
