export interface BracketParticipant {
  id: string | null   // user_id for registered users, null for guests
  name: string | null // display name for guests
}

export interface MatchNode {
  matchNumber: number
  roundNumber: number
  player1Id: string | null
  player1Name: string | null
  player2Id: string | null
  player2Name: string | null
  nextMatchNumber: number | null
  nextMatchSlot: 1 | 2 | null
}

/**
 * Generates a single-elimination bracket.
 *
 * Steps:
 * 1. Optionally shuffle participants (random seeding).
 * 2. Pad to the next power of 2 with nulls (byes).
 * 3. Assign players to first-round match slots using standard
 *    seeding positions (1 vs last, 2 vs second-last...).
 * 4. Wire next_match_id and next_match_slot between rounds.
 */
export function generateBracket(
  participants: BracketParticipant[],
  shuffleSeeds = true
): MatchNode[] {
  if (participants.length < 2) {
    throw new Error('Need at least 2 participants to generate a bracket')
  }

  // 1. Shuffle
  const seeded = [...participants]
  if (shuffleSeeds) {
    for (let i = seeded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[seeded[i], seeded[j]] = [seeded[j], seeded[i]]
    }
  }

  // 2. Pad to next power of 2 with bye slots
  const size = nextPowerOf2(seeded.length)
  while (seeded.length < size) seeded.push({ id: null, name: null })

  // 3. Build seed positions
  const positions = buildSeedPositions(size)
  const slottedPlayers = positions.map((pos) =>
    pos <= seeded.length ? seeded[pos - 1] : { id: null, name: null }
  )

  const totalRounds = Math.log2(size)
  let globalMatchNumber = 1

  // Build per-round match arrays
  const roundMatches: MatchNode[][] = []

  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = size / Math.pow(2, round)
    const list: MatchNode[] = []
    for (let m = 0; m < matchesInRound; m++) {
      list.push({
        matchNumber: globalMatchNumber++,
        roundNumber: round,
        player1Id: null,
        player1Name: null,
        player2Id: null,
        player2Name: null,
        nextMatchNumber: null,
        nextMatchSlot: null,
      })
    }
    roundMatches.push(list)
  }

  // Assign first-round players
  const firstRound = roundMatches[0]
  for (let i = 0; i < firstRound.length; i++) {
    const p1 = slottedPlayers[i * 2]
    const p2 = slottedPlayers[i * 2 + 1]
    firstRound[i].player1Id = p1?.id ?? null
    firstRound[i].player1Name = p1?.name ?? null
    firstRound[i].player2Id = p2?.id ?? null
    firstRound[i].player2Name = p2?.name ?? null
  }

  // 4. Wire next_match links
  for (let r = 0; r < roundMatches.length - 1; r++) {
    const current = roundMatches[r]
    const next = roundMatches[r + 1]
    for (let m = 0; m < current.length; m++) {
      const nextIndex = Math.floor(m / 2)
      const nextSlot: 1 | 2 = m % 2 === 0 ? 1 : 2
      current[m].nextMatchNumber = next[nextIndex].matchNumber
      current[m].nextMatchSlot = nextSlot
    }
  }

  return roundMatches.flat()
}

/** Returns a human-readable round name given round number and total rounds. */
export function getRoundName(roundNumber: number, totalRounds: number): string {
  const fromFinal = totalRounds - roundNumber
  if (fromFinal === 0) return 'Final'
  if (fromFinal === 1) return 'Semi-Final'
  if (fromFinal === 2) return 'Quarter-Final'
  const participantsInRound = Math.pow(2, fromFinal + 1)
  return `Round of ${participantsInRound}`
}

/** Builds the ordered seed position array for a standard single-elimination bracket. */
function buildSeedPositions(size: number): number[] {
  if (size === 1) return [1]
  const half = buildSeedPositions(size / 2)
  const result: number[] = []
  for (const pos of half) {
    result.push(pos)
    result.push(size + 1 - pos)
  }
  return result
}

function nextPowerOf2(n: number): number {
  if (n <= 1) return 1
  return Math.pow(2, Math.ceil(Math.log2(n)))
}

export interface RoundRobinMatch {
  matchNumber: number
  roundNumber: number
  player1: BracketParticipant
  player2: BracketParticipant
}

/**
 * Generates a round-robin schedule using the circle method.
 * Every participant plays every other participant exactly once.
 */
export function generateRoundRobin(
  participants: BracketParticipant[]
): RoundRobinMatch[] {
  const list = [...participants]
  // Pad to even number with a bye
  if (list.length % 2 !== 0) list.push({ id: null, name: 'BYE' })

  const n = list.length
  const rounds = n - 1
  const matchesPerRound = n / 2
  const result: RoundRobinMatch[] = []
  let matchNumber = 1

  // Circle method: fix list[0], rotate the rest
  const rotating = list.slice(1)

  for (let r = 0; r < rounds; r++) {
    const current = [list[0], ...rotating]
    for (let m = 0; m < matchesPerRound; m++) {
      const p1 = current[m]
      const p2 = current[n - 1 - m]
      // Skip bye matches
      if (p1.name !== 'BYE' && p2.name !== 'BYE') {
        result.push({
          matchNumber: matchNumber++,
          roundNumber: r + 1,
          player1: p1,
          player2: p2,
        })
      }
    }
    // Rotate: move last element to front of rotating array
    rotating.unshift(rotating.pop()!)
  }

  return result
}

// ─── Champions League (Swiss System) ─────────────────────────────────────────

export interface CLStanding {
  userId: string | null
  name: string | null
  played: number
  wins: number
  draws: number
  losses: number
  pts: number
  gf: number
  ga: number
  gd: number
}

/** How many Swiss league rounds to play for a given participant count. */
export function clTotalRounds(n: number): number {
  if (n <= 6) return 3
  if (n <= 12) return 4
  if (n <= 20) return 6
  return 7
}

/**
 * How many teams auto-qualify and how many go to the playoff round.
 * Returns { autoQualify, playoffTeams } where playoffTeams is always 2× autoQualify
 * so they produce exactly autoQualify knockout-stage advancers.
 */
export function clAdvancers(n: number): { autoQualify: number; playoffTeams: number } {
  if (n <= 8) return { autoQualify: 2, playoffTeams: 4 }
  if (n <= 24) return { autoQualify: 4, playoffTeams: 8 }
  return { autoQualify: 8, playoffTeams: 16 }
}

/**
 * Generates Swiss-system pairings for the next round.
 * - Sort standings by pts desc, gd desc, gf desc.
 * - Pair from the top: team 1 vs team 2, team 3 vs team 4, etc.
 * - If a pair has already played, slide one team down to find a valid opponent.
 * - If total participants is odd, lowest-ranked team gets a bye (null opponent).
 */
export function generateSwissPairings(
  standings: CLStanding[],
  previousMatchups: Set<string>  // Set of "id1___id2" canonical keys (lower id first)
): { player1: BracketParticipant; player2: BracketParticipant | null }[] {
  const sorted = [...standings].sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
  )

  const key = (a: CLStanding, b: CLStanding) => {
    const ids = [a.userId ?? a.name ?? '', b.userId ?? b.name ?? ''].sort()
    return ids.join('___')
  }

  const paired = new Set<number>()
  const pairs: { player1: BracketParticipant; player2: BracketParticipant | null }[] = []

  for (let i = 0; i < sorted.length; i++) {
    if (paired.has(i)) continue
    const p1 = sorted[i]
    paired.add(i)

    // Find first unpaired opponent not already played
    let found = false
    for (let j = i + 1; j < sorted.length; j++) {
      if (paired.has(j)) continue
      const p2 = sorted[j]
      if (!previousMatchups.has(key(p1, p2))) {
        paired.add(j)
        pairs.push({
          player1: { id: p1.userId, name: p1.name },
          player2: { id: p2.userId, name: p2.name },
        })
        found = true
        break
      }
    }
    // If no valid opponent found (everyone already played this team) — pair with closest anyway
    if (!found) {
      let fallback = -1
      for (let j = i + 1; j < sorted.length; j++) {
        if (!paired.has(j)) { fallback = j; break }
      }
      if (fallback !== -1) {
        paired.add(fallback)
        pairs.push({
          player1: { id: p1.userId, name: p1.name },
          player2: { id: sorted[fallback].userId, name: sorted[fallback].name },
        })
      } else {
        // Bye
        pairs.push({ player1: { id: p1.userId, name: p1.name }, player2: null })
      }
    }
  }

  return pairs
}

// ─── Group Stage ──────────────────────────────────────────────────────────────

export interface GroupBracket {
  groupName: string
  matches: (RoundRobinMatch & { groupName: string })[]
}

/**
 * Splits participants into groups and generates a round-robin schedule per group.
 * groupSize = 4 for 8+ participants, 2 for smaller groups.
 */
export function generateGroups(participants: BracketParticipant[]): GroupBracket[] {
  const shuffled = [...participants]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const groupSize = shuffled.length >= 8 ? 4 : 2
  const groups: BracketParticipant[][] = []
  for (let i = 0; i < shuffled.length; i += groupSize) {
    groups.push(shuffled.slice(i, i + groupSize))
  }

  const groupNames = 'ABCDEFGHIJKLMNOP'.split('')
  let globalMatchNum = 1

  return groups.map((members, idx) => {
    const groupName = groupNames[idx]
    const rrMatches = generateRoundRobin(members).map((m) => ({
      ...m,
      matchNumber: globalMatchNum++,
      groupName,
    }))
    return { groupName, matches: rrMatches }
  })
}

// ─── Double Elimination ───────────────────────────────────────────────────────

export interface DEMatchNode {
  matchNumber: number
  roundNumber: number
  bracket: 'winners' | 'losers' | 'grand_final'
  roundLabel: string
  player1Id: string | null
  player1Name: string | null
  player2Id: string | null
  player2Name: string | null
  nextMatchNumber: number | null
  nextMatchSlot: 1 | 2 | null
  loserNextMatchNumber: number | null
  loserNextMatchSlot: 1 | 2 | null
}

/**
 * Generates a complete double-elimination bracket.
 *
 * For N = 2^k players:
 *   Winners Bracket: k rounds (standard single-elim)
 *   Losers Bracket:  2*(k-1) rounds + LB Final
 *   Grand Final:     1 match
 *
 * Every WB match has loserNextMatchNumber wired to the correct LB match.
 * Losers in LB matches are eliminated.
 */
export function generateDoubleElimination(participants: BracketParticipant[]): DEMatchNode[] {
  const seeded = [...participants]
  for (let i = seeded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[seeded[i], seeded[j]] = [seeded[j], seeded[i]]
  }

  const size = nextPowerOf2(seeded.length)
  while (seeded.length < size) seeded.push({ id: null, name: null })
  const k = Math.log2(size)

  let gm = 1
  const all: DEMatchNode[] = []

  // ── Winners Bracket ─────────────────────────────────────────────────────────
  const positions = buildSeedPositions(size)
  const slotted = positions.map((pos) => seeded[pos - 1] ?? { id: null, name: null })

  const wbRounds: DEMatchNode[][] = []
  for (let r = 1; r <= k; r++) {
    const count = size / Math.pow(2, r)
    const label = r === k ? 'Winners Final' : `Winners Round ${r}`
    const round: DEMatchNode[] = []
    for (let m = 0; m < count; m++) {
      round.push({
        matchNumber: gm++,
        roundNumber: r,
        bracket: 'winners',
        roundLabel: label,
        player1Id: null, player1Name: null,
        player2Id: null, player2Name: null,
        nextMatchNumber: null, nextMatchSlot: null,
        loserNextMatchNumber: null, loserNextMatchSlot: null,
      })
    }
    wbRounds.push(round)
    all.push(...round)
  }

  // Assign first-round players
  for (let i = 0; i < wbRounds[0].length; i++) {
    wbRounds[0][i].player1Id = slotted[i * 2]?.id ?? null
    wbRounds[0][i].player1Name = slotted[i * 2]?.name ?? null
    wbRounds[0][i].player2Id = slotted[i * 2 + 1]?.id ?? null
    wbRounds[0][i].player2Name = slotted[i * 2 + 1]?.name ?? null
  }

  // Wire WB next-match links
  for (let r = 0; r < wbRounds.length - 1; r++) {
    for (let m = 0; m < wbRounds[r].length; m++) {
      wbRounds[r][m].nextMatchNumber = wbRounds[r + 1][Math.floor(m / 2)].matchNumber
      wbRounds[r][m].nextMatchSlot = (m % 2 === 0 ? 1 : 2) as 1 | 2
    }
  }

  // ── Losers Bracket ──────────────────────────────────────────────────────────
  let lbRoundNum = k + 1
  const lbRounds: DEMatchNode[][] = []

  if (k >= 2) {
    // LBR1: WBR1 losers play each other (size/4 matches)
    const lbR1: DEMatchNode[] = []
    for (let m = 0; m < size / 4; m++) {
      lbR1.push({
        matchNumber: gm++,
        roundNumber: lbRoundNum,
        bracket: 'losers',
        roundLabel: 'Losers Round 1',
        player1Id: null, player1Name: null,
        player2Id: null, player2Name: null,
        nextMatchNumber: null, nextMatchSlot: null,
        loserNextMatchNumber: null, loserNextMatchSlot: null,
      })
    }
    lbRounds.push(lbR1)
    all.push(...lbR1)
    lbRoundNum++

    // Wire WBR1 losers → LBR1
    for (let m = 0; m < wbRounds[0].length; m++) {
      wbRounds[0][m].loserNextMatchNumber = lbR1[Math.floor(m / 2)].matchNumber
      wbRounds[0][m].loserNextMatchSlot = (m % 2 === 0 ? 1 : 2) as 1 | 2
    }

    // For WB rounds 2..k-1: even (drop-in) + odd (consolidation) LB rounds
    for (let wbR = 2; wbR <= k - 1; wbR++) {
      const prevLb = lbRounds[lbRounds.length - 1]
      const dropCount = wbRounds[wbR - 1].length
      const evenCount = Math.min(prevLb.length, dropCount)

      const evenRound: DEMatchNode[] = []
      for (let m = 0; m < evenCount; m++) {
        evenRound.push({
          matchNumber: gm++,
          roundNumber: lbRoundNum,
          bracket: 'losers',
          roundLabel: `Losers Round ${lbRounds.length + 1}`,
          player1Id: null, player1Name: null,
          player2Id: null, player2Name: null,
          nextMatchNumber: null, nextMatchSlot: null,
          loserNextMatchNumber: null, loserNextMatchSlot: null,
        })
      }
      for (let m = 0; m < Math.min(prevLb.length, evenRound.length); m++) {
        prevLb[m].nextMatchNumber = evenRound[m].matchNumber
        prevLb[m].nextMatchSlot = 1
      }
      for (let m = 0; m < Math.min(wbRounds[wbR - 1].length, evenRound.length); m++) {
        wbRounds[wbR - 1][m].loserNextMatchNumber = evenRound[m].matchNumber
        wbRounds[wbR - 1][m].loserNextMatchSlot = 2
      }
      lbRounds.push(evenRound)
      all.push(...evenRound)
      lbRoundNum++

      if (evenRound.length > 1) {
        const oddRound: DEMatchNode[] = []
        for (let m = 0; m < Math.floor(evenRound.length / 2); m++) {
          oddRound.push({
            matchNumber: gm++,
            roundNumber: lbRoundNum,
            bracket: 'losers',
            roundLabel: `Losers Round ${lbRounds.length + 1}`,
            player1Id: null, player1Name: null,
            player2Id: null, player2Name: null,
            nextMatchNumber: null, nextMatchSlot: null,
            loserNextMatchNumber: null, loserNextMatchSlot: null,
          })
        }
        for (let m = 0; m < evenRound.length; m++) {
          evenRound[m].nextMatchNumber = oddRound[Math.floor(m / 2)].matchNumber
          evenRound[m].nextMatchSlot = (m % 2 === 0 ? 1 : 2) as 1 | 2
        }
        lbRounds.push(oddRound)
        all.push(...oddRound)
        lbRoundNum++
      }
    }
  }

  // LB Final: last LB round winner vs WB Final loser
  const lbFinal: DEMatchNode = {
    matchNumber: gm++,
    roundNumber: lbRoundNum,
    bracket: 'losers',
    roundLabel: 'Losers Final',
    player1Id: null, player1Name: null,
    player2Id: null, player2Name: null,
    nextMatchNumber: null, nextMatchSlot: null,
    loserNextMatchNumber: null, loserNextMatchSlot: null,
  }
  all.push(lbFinal)
  lbRoundNum++

  if (lbRounds.length > 0) {
    for (const m of lbRounds[lbRounds.length - 1]) {
      m.nextMatchNumber = lbFinal.matchNumber
      m.nextMatchSlot = 2
    }
  }

  const wbFinal = wbRounds[wbRounds.length - 1][0]
  wbFinal.loserNextMatchNumber = lbFinal.matchNumber
  wbFinal.loserNextMatchSlot = 1

  // Grand Final
  const grandFinal: DEMatchNode = {
    matchNumber: gm++,
    roundNumber: lbRoundNum,
    bracket: 'grand_final',
    roundLabel: 'Grand Final',
    player1Id: null, player1Name: null,
    player2Id: null, player2Name: null,
    nextMatchNumber: null, nextMatchSlot: null,
    loserNextMatchNumber: null, loserNextMatchSlot: null,
  }
  all.push(grandFinal)

  wbFinal.nextMatchNumber = grandFinal.matchNumber
  wbFinal.nextMatchSlot = 1
  lbFinal.nextMatchNumber = grandFinal.matchNumber
  lbFinal.nextMatchSlot = 2

  return all
}
