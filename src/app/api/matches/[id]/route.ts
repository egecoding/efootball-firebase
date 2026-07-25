import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendPush } from '@/lib/push'
import { finalizeMatch } from '@/lib/match-finalize'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, tournament_id, round_id, match_number, player1_id, player2_id, player1_score, player2_score, winner_id, status, screenshot_url, submitted_by, next_match_id, next_match_slot, played_at, created_at, updated_at'
    )
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Auth check — regular client only needed for getUser()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // All DB reads/writes use admin client to avoid anon-role RLS issues
  const admin = createAdminClient()

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { player1_score, player2_score, screenshot_url } = body

  // Goals are whole numbers — 2.5 or 1e9 would otherwise flow straight into
  // standings and goal-difference aggregation.
  if (!Number.isInteger(player1_score) || !Number.isInteger(player2_score)) {
    return NextResponse.json({ error: 'Scores must be whole numbers' }, { status: 400 })
  }
  if (player1_score < 0 || player2_score < 0) {
    return NextResponse.json({ error: 'Scores must be non-negative' }, { status: 400 })
  }
  if (player1_score > 99 || player2_score > 99) {
    return NextResponse.json({ error: 'Scores must be 99 or less' }, { status: 400 })
  }

  // Fetch match + tournament format via admin (bypasses RLS for all callers)
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select(
      'id, player1_id, player1_name, player2_id, player2_name, status, next_match_id, next_match_slot, tournament_id, tie_id, leg'
    )
    .eq('id', params.id)
    .single()

  if (matchErr || !match) {
    return NextResponse.json(
      { error: matchErr?.message ?? 'Match not found' },
      { status: matchErr ? 500 : 404 }
    )
  }

  const { data: tournament, error: tournamentErr } = await admin
    .from('tournaments')
    .select('organizer_id, format')
    .eq('id', match.tournament_id)
    .single()

  if (tournamentErr || !tournament) {
    return NextResponse.json(
      { error: tournamentErr?.message ?? 'Tournament not found' },
      { status: tournamentErr ? 500 : 404 }
    )
  }

  const format = (tournament?.format as string) ?? 'knockout'

  // Activate leg 2 when leg 1 is submitted (don't wait for organizer confirmation)
  async function activateLeg2IfNeeded() {
    const m = match as { tie_id?: string | null; leg?: number | null }
    if ((format === 'home_away_knockout' || format === 'group_knockout') && m.tie_id && m.leg === 1) {
      const { data: leg2 } = await admin.from('matches').select('id, status').eq('tie_id', m.tie_id).eq('leg', 2).single()
      if (leg2 && leg2.status === 'pending') {
        await admin.from('matches').update({ status: 'scheduled' }).eq('id', leg2.id)
      }
    }
  }

  const isDrawBlocked =
    format === 'knockout' ||
    (format === 'home_away_knockout' && !(match as { tie_id?: string | null }).tie_id) ||
    format === 'double_elimination'
  if (player1_score === player2_score && isDrawBlocked) {
    return NextResponse.json({ error: 'Draws are not allowed in this match' }, { status: 400 })
  }

  if (!['scheduled', 'awaiting_confirmation'].includes(match.status)) {
    return NextResponse.json(
      { error: 'Match is not in a submittable state' },
      { status: 409 }
    )
  }

  // ── Guest submission via X-Participant-Id header ──────────────────────────
  if (!user) {
    const participantId = request.headers.get('X-Participant-Id')
    if (!participantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: participant, error: participantErr } = await admin
      .from('participants')
      .select('id, name, tournament_id')
      .eq('id', participantId)
      .single()

    if (participantErr || !participant?.name) {
      return NextResponse.json(
        { error: participantErr?.message ?? 'Unauthorized' },
        { status: participantErr ? 500 : 401 }
      )
    }

    // A participant id only grants access within its own tournament, and only to a
    // GUEST slot — registered players' slots also carry a display name, and nothing
    // enforces unique nametags, so a same-named guest could otherwise act as them.
    const isGuestInMatch =
      participant.tournament_id === match.tournament_id &&
      ((match.player1_id === null && match.player1_name === participant.name) ||
        (match.player2_id === null && match.player2_name === participant.name))
    if (!isGuestInMatch) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: updateErr } = await admin
      .from('matches')
      .update({
        player1_score,
        player2_score,
        status: 'awaiting_confirmation',
        screenshot_url: screenshot_url ?? null,
      })
      .eq('id', params.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    await activateLeg2IfNeeded()

    // Notify organizer a result is waiting
    sendPush([tournament?.organizer_id], {
      title: '⚽ Result submitted',
      body: `A player submitted a match result — ready for your confirmation.`,
      url: `/tournaments/${match.tournament_id}/manage`,
    })

    return NextResponse.json({ status: 'awaiting_confirmation' })
  }

  // ── Authenticated user submission ─────────────────────────────────────────
  const isOrganizer = tournament?.organizer_id === user.id
  const isPlayer = match.player1_id === user.id || match.player2_id === user.id

  if (!isPlayer && !isOrganizer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // If organizer directly submits, bypass two-player flow
  if (isOrganizer && !isPlayer) {
    const result = await finalizeMatch(admin, params.id, {
      player1Score: player1_score,
      player2Score: player2_score,
      submittedBy: user.id,
      screenshotUrl: screenshot_url ?? null,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ status: 'completed', winner_id: result.winnerId })
  }

  // Upsert player submission
  const { error: subError } = await admin
    .from('result_submissions')
    .upsert(
      {
        match_id: params.id,
        submitted_by: user.id,
        player1_score,
        player2_score,
        screenshot_url: screenshot_url ?? null,
      },
      { onConflict: 'match_id,submitted_by' }
    )

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  // Fetch all submissions for this match
  const { data: submissions } = await admin
    .from('result_submissions')
    .select('submitted_by, player1_score, player2_score')
    .eq('match_id', params.id)

  const otherPlayerId =
    match.player1_id === user.id ? match.player2_id : match.player1_id
  const otherSubmission = submissions?.find(
    (s) => s.submitted_by === otherPlayerId
  )

  if (!otherSubmission) {
    // First submission only — mark awaiting and store scores on match row so
    // the organizer's confirm route (and manage panel) can read them directly.
    await admin
      .from('matches')
      .update({ status: 'awaiting_confirmation', player1_score, player2_score })
      .eq('id', params.id)
    await activateLeg2IfNeeded()
    sendPush([tournament?.organizer_id], {
      title: '⚽ Result submitted',
      body: `A player submitted a match result — ready for your confirmation.`,
      url: `/tournaments/${match.tournament_id}/manage`,
    })
    return NextResponse.json({ status: 'awaiting_confirmation' })
  }

  // Both submitted — check agreement
  const allAgree = submissions!.every(
    (s) =>
      s.player1_score === submissions![0].player1_score &&
      s.player2_score === submissions![0].player2_score
  )

  if (!allAgree) {
    // Persist the conflict. Without this the match row still holds whichever
    // score was submitted first, and the organizer's manage panel would show it
    // as a normal pending result — they'd confirm one player's unilateral score
    // believing both had agreed.
    const conflict = submissions!
      .map((s) => `${s.player1_score}-${s.player2_score}`)
      .join(' vs ')
    await admin
      .from('matches')
      .update({
        disputed: true,
        dispute_reason: `Players submitted conflicting scores (${conflict}).`,
      })
      .eq('id', params.id)

    sendPush([tournament?.organizer_id], {
      title: '⚠️ Conflicting results',
      body: `Players disagree on a score (${conflict}) — needs your decision.`,
      url: `/tournaments/${match.tournament_id}/manage`,
    })

    return NextResponse.json({
      status: 'disputed',
      message:
        'Score submissions do not match. Contact the organizer to resolve.',
    })
  }

  // Finalize with agreed scores
  const result = await finalizeMatch(admin, params.id, {
    player1Score: submissions![0].player1_score,
    player2Score: submissions![0].player2_score,
    submittedBy: user.id,
    screenshotUrl: screenshot_url ?? null,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ status: 'completed', winner_id: result.winnerId })
}

