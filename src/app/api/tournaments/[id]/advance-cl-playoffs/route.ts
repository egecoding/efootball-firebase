import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateBracket, clTotalRounds, clAdvancers, getRoundName, type CLStanding } from '@/lib/utils/bracket'
import { checkSuperAdmin } from '@/lib/admin-guard'

// POST /api/tournaments/[id]/advance-cl-playoffs
// After all league rounds complete: rank teams, create playoff matches for
// mid-table teams, auto-qualify top teams into QF, eliminate the rest.
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

  // Ensure no playoff/knockout matches already created
  const { data: existing } = await admin
    .from('matches')
    .select('id')
    .eq('tournament_id', params.id)
    .in('bracket', ['playoff'])
    .limit(1)
  if (existing && existing.length > 0)
    return NextResponse.json({ error: 'Playoff stage already created' }, { status: 409 })

  // Fetch all league matches
  const { data: leagueMatches } = await admin
    .from('matches')
    .select('id, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, status')
    .eq('tournament_id', params.id)
    .eq('bracket', 'league')

  if (!leagueMatches) return NextResponse.json({ error: 'No league matches found' }, { status: 409 })

  const incomplete = leagueMatches.filter((m) => m.status !== 'completed' && m.status !== 'walkover')
  if (incomplete.length > 0)
    return NextResponse.json({ error: `${incomplete.length} league match(es) still incomplete` }, { status: 409 })

  // Verify all rounds are done
  const { data: leagueRounds } = await admin
    .from('rounds')
    .select('round_number')
    .eq('tournament_id', params.id)
    .eq('phase', 'league')
    .order('round_number', { ascending: false })
    .limit(1)

  const { data: participants } = await admin
    .from('participants')
    .select('id, user_id, name')
    .eq('tournament_id', params.id)

  const n = participants?.length ?? 0
  const totalRounds = clTotalRounds(n)
  const currentRound = leagueRounds?.[0]?.round_number ?? 0

  if (currentRound < totalRounds)
    return NextResponse.json({ error: `Only ${currentRound}/${totalRounds} league rounds played. Generate all rounds first.` }, { status: 409 })

  // Compute final standings
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

  const sorted = Array.from(standingsMap.values()).sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.wins - a.wins
  )

  const { autoQualify, playoffTeams } = clAdvancers(n)
  const autoTeams = sorted.slice(0, autoQualify)
  const playoffCandidates = sorted.slice(autoQualify, autoQualify + playoffTeams)
  // Rest are eliminated

  // Get next round number
  const { data: lastRound } = await admin
    .from('rounds')
    .select('round_number')
    .eq('tournament_id', params.id)
    .order('round_number', { ascending: false })
    .limit(1)
  let nextRoundNum = ((lastRound?.[0]?.round_number ?? 0) as number) + 1

  // Get next match number
  const { data: lastMatch } = await admin
    .from('matches')
    .select('match_number')
    .eq('tournament_id', params.id)
    .order('match_number', { ascending: false })
    .limit(1)
  let nextMatchNum = ((lastMatch?.[0]?.match_number ?? 0) as number) + 1

  // ── Playoff Round ─────────────────────────────────────────────────────────
  // Seeded: 5th vs 12th, 6th vs 11th, 7th vs 10th, 8th vs 9th
  // (highest seed vs lowest seed within playoff band)
  const playoffPairs: { p1: CLStanding; p2: CLStanding }[] = []
  const pc = playoffCandidates
  for (let i = 0; i < Math.floor(pc.length / 2); i++) {
    playoffPairs.push({ p1: pc[i], p2: pc[pc.length - 1 - i] })
  }

  const playoffRoundsInserted: { id: string }[] = []
  const playoffMatchIds: string[] = []

  if (playoffPairs.length > 0) {
    const { data: pfRound, error: pfRoundErr } = await admin
      .from('rounds')
      .insert({ tournament_id: params.id, round_number: nextRoundNum, round_name: 'Playoff Round', phase: 'playoff' })
      .select()
      .single()
    if (pfRoundErr) return NextResponse.json({ error: pfRoundErr.message }, { status: 500 })
    playoffRoundsInserted.push(pfRound)
    nextRoundNum++

    const playoffPayload = playoffPairs.map((pair, idx) => ({
      tournament_id: params.id,
      round_id: pfRound.id,
      match_number: nextMatchNum + idx,
      player1_id: pair.p1.userId,
      player1_name: pair.p1.name,
      player2_id: pair.p2.userId,
      player2_name: pair.p2.name,
      status: 'scheduled',
      bracket: 'playoff',
    }))
    nextMatchNum += playoffPairs.length

    const { data: playoffMatches, error: pfMatchErr } = await admin
      .from('matches').insert(playoffPayload).select()
    if (pfMatchErr) return NextResponse.json({ error: pfMatchErr.message }, { status: 500 })
    for (const m of playoffMatches) playoffMatchIds.push(m.id)
  }

  // ── Knockout Stage ────────────────────────────────────────────────────────
  // Auto-qualifiers + playoff winner slots (TBD until playoffs resolve)
  // Build bracket from auto-qualifiers + placeholder slots for playoff winners
  const knockoutParticipants = [
    ...autoTeams.map((t) => ({ id: t.userId, name: t.name })),
    ...playoffPairs.map(() => ({ id: null, name: null })), // placeholders — filled when playoffs resolve
  ]

  const brackets = generateBracket(knockoutParticipants, false) // no extra shuffle — already seeded
  const totalKORounds = Math.max(...brackets.map((m) => m.roundNumber))

  const koRoundsPayload = Array.from(new Set(brackets.map((m) => m.roundNumber)))
    .sort((a, b) => a - b)
    .map((rn, idx) => ({
      tournament_id: params.id,
      round_number: nextRoundNum + idx,
      round_name: getRoundName(rn, totalKORounds),
      phase: 'knockout',
    }))

  const { data: koRounds, error: koRoundsErr } = await admin
    .from('rounds').insert(koRoundsPayload).select()
  if (koRoundsErr) return NextResponse.json({ error: koRoundsErr.message }, { status: 500 })

  const localRnToId = new Map(
    koRounds.map((r: { round_number: number; id: string }, i: number) => [i + 1, r.id])
  )

  const koMatchesPayload = brackets.map((m) => ({
    tournament_id: params.id,
    round_id: localRnToId.get(m.roundNumber)!,
    match_number: nextMatchNum++,
    player1_id: m.player1Id,
    player1_name: m.player1Name,
    player2_id: m.player2Id,
    player2_name: m.player2Name,
    next_match_slot: m.nextMatchSlot,
    status: m.player1Id !== null || m.player1Name !== null
      ? m.player2Id !== null || m.player2Name !== null ? 'scheduled' : 'pending'
      : 'pending',
  }))

  const { data: koMatches, error: koMatchesErr } = await admin
    .from('matches').insert(koMatchesPayload).select()
  if (koMatchesErr) return NextResponse.json({ error: koMatchesErr.message }, { status: 500 })

  const koMatchNumberToId = new Map<number, string>(
    koMatches.map((m: { match_number: number; id: string }) => [m.match_number, m.id] as [number, string])
  )

  for (const m of brackets) {
    if (m.nextMatchNumber !== null) {
      const nextId = koMatchNumberToId.get(m.nextMatchNumber)
      const selfId = koMatchNumberToId.get(m.matchNumber)
      if (nextId && selfId) {
        await admin.from('matches').update({ next_match_id: nextId }).eq('id', selfId)
      }
    }
  }

  // Find first-round knockout matches that have TBD slots — store playoff match IDs
  // against them so the playoff confirm route can fill them in.
  // Strategy: KO first round matches with pending status get linked to playoff matches
  // by match_number order (playoff pair 1 → KO slot 1, playoff pair 2 → KO slot 2, ...)
  // We store the link via a special update: next_match_id on playoff match → ko match id
  const koR1Matches = koMatches.filter((m: { round_id: string }) => m.round_id === koRounds[0].id)
  const pendingKOSlots = koR1Matches.filter((m: { player1_id: string | null; player2_id: string | null; player1_name: string | null; player2_name: string | null }) =>
    (m.player1_id === null && m.player1_name === null) ||
    (m.player2_id === null && m.player2_name === null)
  )

  // Wire each playoff match → its target KO slot
  for (let i = 0; i < playoffMatchIds.length && i < pendingKOSlots.length; i++) {
    const koMatch = pendingKOSlots[i]
    const slot = koMatch.player1_id === null && koMatch.player1_name === null ? 1 : 2
    await admin.from('matches')
      .update({ next_match_id: koMatch.id, next_match_slot: slot })
      .eq('id', playoffMatchIds[i])
  }

  return NextResponse.json({
    success: true,
    autoQualified: autoTeams.length,
    playoffMatches: playoffMatchIds.length,
    knockoutMatches: koMatches.length,
    eliminated: sorted.length - autoTeams.length - playoffCandidates.length,
  })
}
