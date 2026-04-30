import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateBracket, generateRoundRobin, generateGroups, generateDoubleElimination, generateSwissPairings, clTotalRounds, getRoundName } from '@/lib/utils/bracket'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('organizer_id, status, format')
    .eq('id', params.id)
    .single()

  if (!tournament || tournament.organizer_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (tournament.status !== 'open')
    return NextResponse.json({ error: 'Tournament must be in "open" status to start' }, { status: 409 })

  const { data: participants } = await supabase
    .from('participants')
    .select('id, user_id, name')
    .eq('tournament_id', params.id)

  if (!participants || participants.length < 2)
    return NextResponse.json({ error: 'Need at least 2 participants to start' }, { status: 409 })

  const bracketParticipants = participants.map((p) => ({
    id: p.user_id ?? null,
    name: p.name ?? null,
    participantId: p.id,
  }))

  const format = (tournament.format as string) ?? 'knockout'

  if (format === 'knockout') {
    return startKnockout(supabase, params.id, bracketParticipants)
  } else if (format === 'double_elimination') {
    if (participants.length < 4)
      return NextResponse.json({ error: 'Double elimination requires at least 4 participants' }, { status: 409 })
    return startDoubleElimination(supabase, params.id, bracketParticipants)
  } else if (format === 'group_knockout') {
    if (participants.length < 4)
      return NextResponse.json({ error: 'Group stage requires at least 4 participants' }, { status: 409 })
    return startGroupKnockout(supabase, params.id, bracketParticipants)
  } else if (format === 'champions_league') {
    if (participants.length < 4)
      return NextResponse.json({ error: 'Champions League format requires at least 4 participants' }, { status: 409 })
    return startChampionsLeague(supabase, params.id, bracketParticipants)
  } else {
    return startRoundRobin(supabase, params.id, bracketParticipants, format)
  }
}

async function startKnockout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tournamentId: string,
  bracketParticipants: { id: string | null; name: string | null; participantId: string }[]
) {
  const matches = generateBracket(bracketParticipants)
  const totalRounds = Math.max(...matches.map((m) => m.roundNumber))

  const roundsPayload = Array.from(new Set(matches.map((m) => m.roundNumber)))
    .sort((a, b) => a - b)
    .map((rn) => ({
      tournament_id: tournamentId,
      round_number: rn,
      round_name: getRoundName(rn, totalRounds),
      phase: 'knockout',
    }))

  const { data: insertedRounds, error: roundsError } = await supabase
    .from('rounds').insert(roundsPayload).select()
  if (roundsError) return NextResponse.json({ error: roundsError.message }, { status: 500 })

  const roundMap = new Map(insertedRounds.map((r: { round_number: number; id: string }) => [r.round_number, r.id]))

  const matchesPayload = matches.map((m) => ({
    tournament_id: tournamentId,
    round_id: roundMap.get(m.roundNumber)!,
    match_number: m.matchNumber,
    player1_id: m.player1Id,
    player1_name: m.player1Name,
    player2_id: m.player2Id,
    player2_name: m.player2Name,
    next_match_slot: m.nextMatchSlot,
    status: determineStatus(
      m.player1Id !== null || m.player1Name !== null,
      m.player2Id !== null || m.player2Name !== null
    ),
  }))

  const { data: insertedMatches, error: matchesError } = await supabase
    .from('matches').insert(matchesPayload).select()
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 })

  const matchNumberToId = new Map(insertedMatches.map((m: { match_number: number; id: string }) => [m.match_number, m.id]))

  for (const m of matches) {
    if (m.nextMatchNumber !== null) {
      await supabase.from('matches')
        .update({ next_match_id: matchNumberToId.get(m.nextMatchNumber) })
        .eq('id', matchNumberToId.get(m.matchNumber)!)
    }
  }

  for (const match of insertedMatches) {
    const hasP1 = match.player1_id !== null || match.player1_name !== null
    const hasP2 = match.player2_id !== null || match.player2_name !== null
    if ((hasP1 && !hasP2) || (!hasP1 && hasP2)) {
      const winner_id = hasP1 ? match.player1_id : match.player2_id
      const winner_name = hasP1 ? match.player1_name : match.player2_name
      await supabase.from('matches').update({ winner_id, status: 'walkover' }).eq('id', match.id)
      if (match.next_match_id && match.next_match_slot) {
        const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
        const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'
        await supabase.from('matches')
          .update({ [idField]: winner_id, [nameField]: winner_name, status: 'scheduled' })
          .eq('id', match.next_match_id)
      }
    }
  }

  await supabase.from('tournaments').update({ status: 'in_progress' }).eq('id', tournamentId)
  for (let i = 0; i < bracketParticipants.length; i++) {
    await supabase.from('participants').update({ seed: i + 1 }).eq('id', bracketParticipants[i].participantId)
  }

  return NextResponse.json({ success: true, rounds: insertedRounds.length, matches: insertedMatches.length })
}

async function startRoundRobin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tournamentId: string,
  bracketParticipants: { id: string | null; name: string | null; participantId: string }[],
  format: string
) {
  const rrMatches = generateRoundRobin(bracketParticipants)
  const totalRounds = Math.max(...rrMatches.map((m) => m.roundNumber))

  const roundNumbers = Array.from(new Set(rrMatches.map((m) => m.roundNumber))).sort((a, b) => a - b)
  const roundsPayload = roundNumbers.map((rn) => ({
    tournament_id: tournamentId,
    round_number: rn,
    round_name: `Round ${rn}`,
  }))

  const { data: insertedRounds, error: roundsError } = await supabase
    .from('rounds').insert(roundsPayload).select()
  if (roundsError) return NextResponse.json({ error: roundsError.message }, { status: 500 })

  const roundMap = new Map(insertedRounds.map((r: { round_number: number; id: string }) => [r.round_number, r.id]))

  const matchesPayload = rrMatches.map((m) => ({
    tournament_id: tournamentId,
    round_id: roundMap.get(m.roundNumber)!,
    match_number: m.matchNumber,
    player1_id: m.player1.id,
    player1_name: m.player1.name,
    player2_id: m.player2.id,
    player2_name: m.player2.name,
    status: 'scheduled',
  }))

  const { data: insertedMatches, error: matchesError } = await supabase
    .from('matches').insert(matchesPayload).select()
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 })

  await supabase.from('tournaments').update({ status: 'in_progress' }).eq('id', tournamentId)

  return NextResponse.json({ success: true, rounds: totalRounds, matches: insertedMatches.length })
}

async function startGroupKnockout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tournamentId: string,
  bracketParticipants: { id: string | null; name: string | null; participantId: string }[]
) {
  const groups = generateGroups(bracketParticipants)

  // Collect all unique round numbers across groups and create rounds
  // Each group has its own set of round numbers starting from 1.
  // We interleave: Group A Round 1 → round 1, Group B Round 1 → round 2, Group A Round 2 → round 3, ...
  // Simpler: assign global round numbers sequentially per group-round
  const maxGroupRounds = Math.max(...groups.map((g) => Math.max(...g.matches.map((m) => m.roundNumber))))

  const roundsPayload: { tournament_id: string; round_number: number; round_name: string; phase: string }[] = []
  let globalRoundNum = 1
  // Round per (roundIndex, groupIndex) — interleaved
  const roundKeyToGlobal = new Map<string, number>()
  for (let rn = 1; rn <= maxGroupRounds; rn++) {
    for (let gi = 0; gi < groups.length; gi++) {
      const groupName = groups[gi].groupName
      roundKeyToGlobal.set(`${gi}_${rn}`, globalRoundNum)
      roundsPayload.push({
        tournament_id: tournamentId,
        round_number: globalRoundNum,
        round_name: `Group ${groupName} · Round ${rn}`,
        phase: 'group',
      })
      globalRoundNum++
    }
  }

  const { data: insertedRounds, error: roundsError } = await supabase
    .from('rounds').insert(roundsPayload).select()
  if (roundsError) return NextResponse.json({ error: roundsError.message }, { status: 500 })

  const roundNumberToId = new Map(insertedRounds.map((r: { round_number: number; id: string }) => [r.round_number, r.id]))

  // Build matches payload
  const matchesPayload: object[] = []
  let matchNum = 1
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    for (const m of group.matches) {
      const globalRn = roundKeyToGlobal.get(`${gi}_${m.roundNumber}`)!
      matchesPayload.push({
        tournament_id: tournamentId,
        round_id: roundNumberToId.get(globalRn)!,
        match_number: matchNum++,
        player1_id: m.player1.id,
        player1_name: m.player1.name,
        player2_id: m.player2.id,
        player2_name: m.player2.name,
        status: 'scheduled',
        group_name: group.groupName,
      })
    }
  }

  const { data: insertedMatches, error: matchesError } = await supabase
    .from('matches').insert(matchesPayload).select()
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 })

  await supabase.from('tournaments').update({ status: 'in_progress' }).eq('id', tournamentId)

  return NextResponse.json({ success: true, groups: groups.length, matches: insertedMatches.length })
}

async function startDoubleElimination(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tournamentId: string,
  bracketParticipants: { id: string | null; name: string | null; participantId: string }[]
) {
  const deMatches = generateDoubleElimination(bracketParticipants)

  // Build rounds from unique (roundNumber, roundLabel, bracket) combinations
  const roundEntries = new Map<number, { label: string; bracket: string }>()
  for (const m of deMatches) {
    if (!roundEntries.has(m.roundNumber)) {
      roundEntries.set(m.roundNumber, { label: m.roundLabel, bracket: m.bracket })
    }
  }

  const roundsPayload = Array.from(roundEntries.entries())
    .sort(([a], [b]) => a - b)
    .map(([rn, { label, bracket }]) => ({
      tournament_id: tournamentId,
      round_number: rn,
      round_name: label,
      phase: bracket === 'grand_final' ? 'grand_final' : bracket === 'winners' ? 'winners' : 'losers',
    }))

  const { data: insertedRounds, error: roundsError } = await supabase
    .from('rounds').insert(roundsPayload).select()
  if (roundsError) return NextResponse.json({ error: roundsError.message }, { status: 500 })

  const roundMap = new Map(insertedRounds.map((r: { round_number: number; id: string }) => [r.round_number, r.id]))

  const matchesPayload = deMatches.map((m) => ({
    tournament_id: tournamentId,
    round_id: roundMap.get(m.roundNumber)!,
    match_number: m.matchNumber,
    player1_id: m.player1Id,
    player1_name: m.player1Name,
    player2_id: m.player2Id,
    player2_name: m.player2Name,
    next_match_slot: m.nextMatchSlot,
    loser_next_match_slot: m.loserNextMatchSlot,
    bracket: m.bracket,
    status: determineStatus(
      m.player1Id !== null || m.player1Name !== null,
      m.player2Id !== null || m.player2Name !== null
    ),
  }))

  const { data: insertedMatches, error: matchesError } = await supabase
    .from('matches').insert(matchesPayload).select()
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 })

  const matchNumberToId = new Map<number, string>(
    insertedMatches.map((m: { match_number: number; id: string }) => [m.match_number, m.id] as [number, string])
  )

  // Wire next_match_id and loser_next_match_id
  for (const m of deMatches) {
    const updates: Record<string, string> = {}
    if (m.nextMatchNumber !== null) {
      const nextId = matchNumberToId.get(m.nextMatchNumber)
      if (nextId) updates.next_match_id = nextId
    }
    if (m.loserNextMatchNumber !== null) {
      const loserId = matchNumberToId.get(m.loserNextMatchNumber)
      if (loserId) updates.loser_next_match_id = loserId
    }
    if (Object.keys(updates).length > 0) {
      const selfId = matchNumberToId.get(m.matchNumber)
      if (selfId) await supabase.from('matches').update(updates).eq('id', selfId)
    }
  }

  // Handle walkovers (byes) — advance winner, do NOT route bye to LB
  for (const match of insertedMatches) {
    const hasP1 = match.player1_id !== null || match.player1_name !== null
    const hasP2 = match.player2_id !== null || match.player2_name !== null
    if ((hasP1 && !hasP2) || (!hasP1 && hasP2)) {
      const winner_id = hasP1 ? match.player1_id : match.player2_id
      const winner_name = hasP1 ? match.player1_name : match.player2_name
      await supabase.from('matches').update({ winner_id, status: 'walkover' }).eq('id', match.id)
      if (match.next_match_id && match.next_match_slot) {
        const idField = match.next_match_slot === 1 ? 'player1_id' : 'player2_id'
        const nameField = match.next_match_slot === 1 ? 'player1_name' : 'player2_name'
        await supabase.from('matches')
          .update({ [idField]: winner_id, [nameField]: winner_name, status: 'scheduled' })
          .eq('id', match.next_match_id)
      }
      // Note: do NOT advance null/bye to loser_next_match_id
    }
  }

  await supabase.from('tournaments').update({ status: 'in_progress' }).eq('id', tournamentId)
  for (let i = 0; i < bracketParticipants.length; i++) {
    await supabase.from('participants').update({ seed: i + 1 }).eq('id', bracketParticipants[i].participantId)
  }

  return NextResponse.json({ success: true, rounds: insertedRounds.length, matches: insertedMatches.length })
}

async function startChampionsLeague(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tournamentId: string,
  bracketParticipants: { id: string | null; name: string | null; participantId: string }[]
) {
  const n = bracketParticipants.length

  // Build initial standings (all zeros) as CLStanding for Swiss pairing
  const standings = bracketParticipants.map((p) => ({
    userId: p.id,
    name: p.name,
    played: 0, wins: 0, draws: 0, losses: 0,
    pts: 0, gf: 0, ga: 0, gd: 0,
  }))

  // Shuffle for random round-1 pairings
  for (let i = standings.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[standings[i], standings[j]] = [standings[j], standings[i]]
  }

  const pairs = generateSwissPairings(standings, new Set())

  // Create round 1
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({ tournament_id: tournamentId, round_number: 1, round_name: 'League Round 1', phase: 'league' })
    .select()
    .single()
  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 })

  const matchesPayload = pairs.map((pair, idx) => ({
    tournament_id: tournamentId,
    round_id: round.id,
    match_number: idx + 1,
    player1_id: pair.player1.id,
    player1_name: pair.player1.name,
    player2_id: pair.player2?.id ?? null,
    player2_name: pair.player2?.name ?? null,
    status: pair.player2 ? 'scheduled' : 'walkover',
    bracket: 'league',
  }))

  const { data: insertedMatches, error: matchesError } = await supabase
    .from('matches').insert(matchesPayload).select()
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 })

  // Handle byes — walkover wins (1pt each, or 3pt? Use 3pt for consistency with wins)
  for (const match of insertedMatches) {
    if (!match.player2_id && !match.player2_name) {
      await supabase.from('matches')
        .update({ player1_score: 1, player2_score: 0, winner_id: match.player1_id, status: 'walkover' })
        .eq('id', match.id)
    }
  }

  const totalRounds = clTotalRounds(n)
  await supabase.from('tournaments').update({ status: 'in_progress' }).eq('id', tournamentId)

  return NextResponse.json({ success: true, totalRounds, matches: insertedMatches.length })
}

function determineStatus(hasP1: boolean, hasP2: boolean): 'pending' | 'scheduled' | 'walkover' {
  if (!hasP1 && !hasP2) return 'pending'
  if (!hasP1 || !hasP2) return 'walkover'
  return 'scheduled'
}
