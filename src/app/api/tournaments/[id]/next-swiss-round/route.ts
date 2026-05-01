import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateSwissPairings, clTotalRounds, type CLStanding } from '@/lib/utils/bracket'
import { checkSuperAdmin } from '@/lib/admin-guard'

// POST /api/tournaments/[id]/next-swiss-round
// For champions_league tournaments: calculates standings from completed league
// matches, generates next-round Swiss pairings, inserts the new round + matches.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: tournament } = await admin
    .from('tournaments')
    .select('organizer_id, status, format')
    .eq('id', params.id)
    .single()

  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  const superAdmin = await checkSuperAdmin(user.id)
  if (tournament.organizer_id !== user.id && !superAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (tournament.format !== 'champions_league') return NextResponse.json({ error: 'Only for champions_league format' }, { status: 400 })

  // Fetch all league-phase matches
  const { data: leagueMatches } = await admin
    .from('matches')
    .select('id, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, status, winner_id, rounds(round_number, phase)')
    .eq('tournament_id', params.id)
    .eq('bracket', 'league')

  if (!leagueMatches || leagueMatches.length === 0)
    return NextResponse.json({ error: 'No league matches found' }, { status: 409 })

  // Check all current league matches are completed
  const incomplete = leagueMatches.filter((m) => m.status !== 'completed' && m.status !== 'walkover')
  if (incomplete.length > 0)
    return NextResponse.json({ error: `${incomplete.length} match(es) still pending. Complete all current round matches first.` }, { status: 409 })

  // Get current round number
  const { data: leagueRounds } = await admin
    .from('rounds')
    .select('round_number')
    .eq('tournament_id', params.id)
    .eq('phase', 'league')
    .order('round_number', { ascending: false })
    .limit(1)

  const currentRound = leagueRounds?.[0]?.round_number ?? 1

  // Fetch participants for ID lookup
  const { data: participants } = await admin
    .from('participants')
    .select('id, user_id, name')
    .eq('tournament_id', params.id)

  const totalRounds = clTotalRounds(participants?.length ?? 0)

  if (currentRound >= totalRounds)
    return NextResponse.json({ error: 'All league rounds already played. Advance to playoffs instead.' }, { status: 409 })

  // Compute standings from all completed league matches
  const standingsMap = new Map<string, CLStanding>()

  const getKey = (userId: string | null, name: string | null) => userId ?? name ?? ''

  const getOrCreate = (userId: string | null, name: string | null): CLStanding => {
    const k = getKey(userId, name)
    if (!standingsMap.has(k)) {
      standingsMap.set(k, { userId, name, played: 0, wins: 0, draws: 0, losses: 0, pts: 0, gf: 0, ga: 0, gd: 0 })
    }
    return standingsMap.get(k)!
  }

  for (const m of leagueMatches) {
    if (m.status !== 'completed' && m.status !== 'walkover') continue
    const s1 = m.player1_score ?? 0
    const s2 = m.player2_score ?? 0
    const p1 = getOrCreate(m.player1_id, m.player1_name)
    const p2 = getOrCreate(m.player2_id, m.player2_name)

    p1.played++; p2.played++
    p1.gf += s1; p1.ga += s2; p1.gd = p1.gf - p1.ga
    p2.gf += s2; p2.ga += s1; p2.gd = p2.gf - p2.ga

    if (s1 > s2) { p1.pts += 3; p1.wins++ ; p2.losses++ }
    else if (s2 > s1) { p2.pts += 3; p2.wins++ ; p1.losses++ }
    else { p1.pts += 1; p2.pts += 1; p1.draws++; p2.draws++ }
  }

  // Build previousMatchups set so we don't repeat
  const previousMatchups = new Set<string>()
  for (const m of leagueMatches) {
    const ids = [m.player1_id ?? m.player1_name ?? '', m.player2_id ?? m.player2_name ?? ''].sort()
    previousMatchups.add(ids.join('___'))
  }

  const standings = Array.from(standingsMap.values())
  const pairs = generateSwissPairings(standings, previousMatchups)

  const nextRoundNum = currentRound + 1

  const { data: round, error: roundError } = await admin
    .from('rounds')
    .insert({
      tournament_id: params.id,
      round_number: nextRoundNum,
      round_name: `League Round ${nextRoundNum}`,
      phase: 'league',
    })
    .select()
    .single()
  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 })

  // Compute next match_number (globally unique)
  const { data: existingMatches } = await admin
    .from('matches')
    .select('match_number')
    .eq('tournament_id', params.id)
    .order('match_number', { ascending: false })
    .limit(1)
  const nextMatchNum = ((existingMatches?.[0]?.match_number ?? 0) as number) + 1

  const matchesPayload = pairs.map((pair, idx) => ({
    tournament_id: params.id,
    round_id: round.id,
    match_number: nextMatchNum + idx,
    player1_id: pair.player1.id,
    player1_name: pair.player1.name,
    player2_id: pair.player2?.id ?? null,
    player2_name: pair.player2?.name ?? null,
    status: pair.player2 ? 'scheduled' : 'walkover',
    bracket: 'league',
  }))

  const { data: insertedMatches, error: matchesError } = await admin
    .from('matches').insert(matchesPayload).select()
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 })

  for (const match of insertedMatches) {
    if (!match.player2_id && !match.player2_name) {
      await admin.from('matches')
        .update({ player1_score: 1, player2_score: 0, winner_id: match.player1_id, status: 'walkover' })
        .eq('id', match.id)
    }
  }

  return NextResponse.json({ success: true, round: nextRoundNum, totalRounds, matches: insertedMatches.length })
}
