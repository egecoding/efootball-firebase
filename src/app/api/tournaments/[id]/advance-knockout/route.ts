import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateBracket, getRoundName } from '@/lib/utils/bracket'
import { randomUUID } from 'crypto'
import { checkSuperAdmin } from '@/lib/admin-guard'

// POST /api/tournaments/[id]/advance-knockout
// For group_knockout tournaments: calculates group standings after all group
// matches complete, then generates the two-legged knockout bracket.
// All rounds except the final use home + away legs.
// The final is a single match.
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
  if (tournament.format !== 'group_knockout') return NextResponse.json({ error: 'Only for group_knockout format' }, { status: 400 })
  if (tournament.status !== 'in_progress') return NextResponse.json({ error: 'Tournament must be in_progress' }, { status: 409 })

  // Fetch all group matches
  const { data: groupMatches } = await admin
    .from('matches')
    .select('id, group_name, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, status, winner_id')
    .eq('tournament_id', params.id)
    .not('group_name', 'is', null)

  if (!groupMatches || groupMatches.length === 0)
    return NextResponse.json({ error: 'No group matches found' }, { status: 409 })

  const pending = groupMatches.filter((m) => m.status !== 'completed' && m.status !== 'walkover')
  if (pending.length > 0)
    return NextResponse.json({ error: `${pending.length} group match(es) still pending. Complete all group matches first.` }, { status: 409 })

  // Check no knockout rounds already exist
  const { data: existingKnockout } = await admin
    .from('matches')
    .select('id')
    .eq('tournament_id', params.id)
    .is('group_name', null)
    .limit(1)

  if (existingKnockout && existingKnockout.length > 0)
    return NextResponse.json({ error: 'Knockout stage already exists' }, { status: 409 })

  // Fetch participants for ID lookup
  const { data: participants } = await admin
    .from('participants')
    .select('id, user_id, name')
    .eq('tournament_id', params.id)

  const participantByUserId = new Map<string, string>()
  const participantByName = new Map<string, string>()
  for (const p of participants ?? []) {
    if (p.user_id) participantByUserId.set(p.user_id, p.id)
    if (p.name) participantByName.set(p.name, p.id)
  }

  // Calculate standings per group
  interface Standing {
    userId: string | null
    name: string | null
    participantId: string
    pts: number
    wins: number
    gf: number
    ga: number
  }

  const groupStandings = new Map<string, Standing[]>()

  for (const m of groupMatches) {
    const groupName: string = m.group_name
    if (!groupStandings.has(groupName)) groupStandings.set(groupName, [])
    const standings = groupStandings.get(groupName)!

    const getOrCreate = (userId: string | null, name: string | null): Standing => {
      const existing = standings.find((s) =>
        userId ? s.userId === userId : s.name === name
      )
      if (existing) return existing
      const participantId = userId
        ? participantByUserId.get(userId) ?? ''
        : participantByName.get(name ?? '') ?? ''
      const entry: Standing = { userId, name, participantId, pts: 0, wins: 0, gf: 0, ga: 0 }
      standings.push(entry)
      return entry
    }

    const p1 = getOrCreate(m.player1_id, m.player1_name)
    const p2 = getOrCreate(m.player2_id, m.player2_name)
    const s1 = m.player1_score ?? 0
    const s2 = m.player2_score ?? 0

    p1.gf += s1; p1.ga += s2
    p2.gf += s2; p2.ga += s1

    if (s1 > s2) { p1.pts += 3; p1.wins += 1 }
    else if (s2 > s1) { p2.pts += 3; p2.wins += 1 }
    else { p1.pts += 1; p2.pts += 1 }
  }

  const advancers: { id: string | null; name: string | null; participantId: string }[] = []

  const sortedGroupNames = Array.from(groupStandings.keys()).sort()
  const advancePerGroup = groupStandings.get(sortedGroupNames[0])!.length <= 2 ? 1 : 2

  for (const gName of sortedGroupNames) {
    const standings = groupStandings.get(gName)!
    standings.sort((a, b) =>
      b.pts - a.pts ||
      (b.gf - b.ga) - (a.gf - a.ga) ||
      b.gf - a.gf ||
      b.wins - a.wins
    )
    const top = standings.slice(0, advancePerGroup)
    for (const s of top) {
      advancers.push({ id: s.userId, name: s.name, participantId: s.participantId })
    }
  }

  if (advancers.length < 2)
    return NextResponse.json({ error: 'Not enough advancers for knockout stage' }, { status: 409 })

  // Generate bracket structure (determines who plays who and wiring)
  const brackets = generateBracket(advancers, false)
  const totalRounds = Math.max(...brackets.map((m) => m.roundNumber))
  const isFinal = (roundNumber: number) => roundNumber === totalRounds

  // Find next available round/match numbers
  const { data: existingRounds } = await admin
    .from('rounds')
    .select('round_number')
    .eq('tournament_id', params.id)
    .order('round_number', { ascending: false })
    .limit(1)

  const { data: existingMatches } = await admin
    .from('matches')
    .select('match_number')
    .eq('tournament_id', params.id)
    .order('match_number', { ascending: false })
    .limit(1)

  let nextRoundNum = ((existingRounds?.[0]?.round_number ?? 0) as number) + 1
  let nextMatchNum = ((existingMatches?.[0]?.match_number ?? 0) as number) + 1

  // Build round rows — each bracket round that is NOT the final gets two rounds (Leg 1 + Leg 2)
  // The final gets one round.
  // roundNumber in brackets → [ leg1RoundId, leg2RoundId? ]
  const bracketRoundToRoundIds = new Map<number, { leg1: string; leg2?: string }>()

  const roundsPayload: object[] = []
  for (let rn = 1; rn <= totalRounds; rn++) {
    const label = getRoundName(rn, totalRounds)
    if (isFinal(rn)) {
      roundsPayload.push({ tournament_id: params.id, round_number: nextRoundNum, round_name: `Final`, phase: 'knockout' })
      bracketRoundToRoundIds.set(rn, { leg1: `__placeholder_${nextRoundNum}` })
      nextRoundNum++
    } else {
      roundsPayload.push({ tournament_id: params.id, round_number: nextRoundNum, round_name: `${label} — 1st Leg`, phase: 'knockout' })
      roundsPayload.push({ tournament_id: params.id, round_number: nextRoundNum + 1, round_name: `${label} — 2nd Leg`, phase: 'knockout' })
      bracketRoundToRoundIds.set(rn, { leg1: `__placeholder_${nextRoundNum}`, leg2: `__placeholder_${nextRoundNum + 1}` })
      nextRoundNum += 2
    }
  }

  const { data: insertedRounds, error: roundsError } = await admin
    .from('rounds').insert(roundsPayload).select()
  if (roundsError) return NextResponse.json({ error: roundsError.message }, { status: 500 })

  // Build round_number → id map
  const roundNumToId = new Map<number, string>(
    insertedRounds.map((r: { round_number: number; id: string }) => [r.round_number, r.id] as [number, string])
  )

  // Now translate placeholder keys → real UUIDs
  const resolvedRoundIds = new Map<number, { leg1: string; leg2?: string }>()
  {
    let rn = 1
    let cur = ((existingRounds?.[0]?.round_number ?? 0) as number) + 1
    for (; rn <= totalRounds; rn++) {
      if (isFinal(rn)) {
        resolvedRoundIds.set(rn, { leg1: roundNumToId.get(cur)! })
        cur++
      } else {
        resolvedRoundIds.set(rn, { leg1: roundNumToId.get(cur)!, leg2: roundNumToId.get(cur + 1)! })
        cur += 2
      }
    }
  }

  // Build matches
  // For each bracket match:
  //   - Final → 1 match (no tie_id / leg)
  //   - Others → 2 matches sharing a tie_id (UUIDv4), leg 1 + leg 2 (home/away swapped)
  //
  // next_match_id wiring: leg 2 of each tie → its next-round leg 1 (the first leg of the next tie)
  // We collect all inserted matches first, then wire next_match_id in a second pass.

  interface MatchPayload {
    tournament_id: string
    round_id: string
    match_number: number
    player1_id: string | null
    player1_name: string | null
    player2_id: string | null
    player2_name: string | null
    next_match_slot: 1 | 2 | null
    status: string
    tie_id?: string
    leg?: number
  }

  // bracket match_number → { leg1MatchNumber, leg2MatchNumber? }
  const bracketMatchToLegs = new Map<number, { leg1: number; leg2?: number }>()
  const matchesPayload: MatchPayload[] = []

  for (const m of brackets) {
    const roundIds = resolvedRoundIds.get(m.roundNumber)!
    const tieId = isFinal(m.roundNumber) ? undefined : randomUUID()

    const hasP1 = m.player1Id !== null || m.player1Name !== null
    const hasP2 = m.player2Id !== null || m.player2Name !== null
    const status = hasP1 && hasP2 ? 'scheduled' : hasP1 || hasP2 ? 'walkover' : 'pending'

    const leg1Num = nextMatchNum++
    matchesPayload.push({
      tournament_id: params.id,
      round_id: roundIds.leg1,
      match_number: leg1Num,
      player1_id: m.player1Id,
      player1_name: m.player1Name,
      player2_id: m.player2Id,
      player2_name: m.player2Name,
      next_match_slot: isFinal(m.roundNumber) ? m.nextMatchSlot : null,
      status,
      tie_id: tieId,
      leg: isFinal(m.roundNumber) ? undefined : 1,
    })

    if (!isFinal(m.roundNumber)) {
      const leg2Num = nextMatchNum++
      // Leg 2: home/away swapped
      matchesPayload.push({
        tournament_id: params.id,
        round_id: roundIds.leg2!,
        match_number: leg2Num,
        player1_id: m.player2Id,   // swapped
        player1_name: m.player2Name,
        player2_id: m.player1Id,   // swapped
        player2_name: m.player1Name,
        next_match_slot: m.nextMatchSlot,
        status: status === 'scheduled' ? 'pending' : status, // leg 2 starts pending until leg 1 done
        tie_id: tieId,
        leg: 2,
      })
      bracketMatchToLegs.set(m.matchNumber, { leg1: leg1Num, leg2: leg2Num })
    } else {
      bracketMatchToLegs.set(m.matchNumber, { leg1: leg1Num })
    }
  }

  const { data: insertedMatches, error: matchesError } = await admin
    .from('matches').insert(matchesPayload).select()
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 })

  const matchNumToId = new Map<number, string>(
    insertedMatches.map((m: { match_number: number; id: string }) => [m.match_number, m.id] as [number, string])
  )

  // Wire next_match_id:
  // - Leg 1 → Leg 2 of same tie (so leg 1 completion unlocks leg 2)
  // - Leg 2 → Leg 1 of next round (so after aggregate is resolved, winner advances)
  for (const m of brackets) {
    const legs = bracketMatchToLegs.get(m.matchNumber)!
    if (legs.leg2 !== undefined) {
      // leg1 → leg2 (same tie)
      const leg1Id = matchNumToId.get(legs.leg1)!
      const leg2Id = matchNumToId.get(legs.leg2)!
      await admin.from('matches').update({ next_match_id: leg2Id, next_match_slot: null }).eq('id', leg1Id)
    }

    // leg2 (or single leg for final) → next round leg1
    if (m.nextMatchNumber !== null) {
      const nextLegs = bracketMatchToLegs.get(m.nextMatchNumber)!
      const nextLeg1Id = matchNumToId.get(nextLegs.leg1)!
      const thisLegId = legs.leg2 !== undefined ? matchNumToId.get(legs.leg2)! : matchNumToId.get(legs.leg1)!
      await admin.from('matches').update({ next_match_id: nextLeg1Id, next_match_slot: m.nextMatchSlot }).eq('id', thisLegId)
    }
  }

  return NextResponse.json({ success: true, advancers: advancers.length, matches: insertedMatches.length })
}
