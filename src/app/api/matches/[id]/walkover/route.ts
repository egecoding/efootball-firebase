import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkSuperAdmin } from '@/lib/admin-guard'

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
    .select('id, player1_id, player1_name, player2_id, player2_name, status, next_match_id, next_match_slot, tie_id, leg, tournament_id, group_name, bracket')
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

  await admin
    .from('matches')
    .update({ winner_id, status: 'walkover', played_at: new Date().toISOString() })
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
      await admin.from('matches').update({
        winner_id,
        status: 'walkover',
        [`${leg2WinnerSlot}_id`]: winner_id,
        [`${leg2WinnerSlot}_name`]: winner_name,
        played_at: new Date().toISOString(),
      }).eq('id', leg2.id)
    }
  }

  // Advance winner to next match
  if (match.next_match_id && match.next_match_slot) {
    const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
    const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'

    await admin.from('matches')
      .update({ [idField]: winner_id ?? null, [nameField]: winner_name ?? null, status: 'scheduled' })
      .eq('id', match.next_match_id)
  }

  // Check tournament completion
  if (!match.next_match_id) {
    const fmt = tournament.format
    let checkRemaining = false

    if (fmt === 'knockout' || fmt === 'home_away_knockout' || fmt === 'double_elimination') {
      checkRemaining = true
    } else if ((fmt === 'group_knockout' || fmt === 'champions_league') && !match.group_name) {
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
