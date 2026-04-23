export interface MatchNode {
  matchNumber: number
  roundNumber: number
  player1Id: string | null
  player2Id: string | null
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
  participantIds: string[],
  shuffleSeeds = true
): MatchNode[] {
  if (participantIds.length < 2) {
    throw new Error('Need at least 2 participants to generate a bracket')
  }

  // 1. Shuffle
  const seeded = [...participantIds]
  if (shuffleSeeds) {
    for (let i = seeded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[seeded[i], seeded[j]] = [seeded[j], seeded[i]]
    }
  }

  // 2. Pad to next power of 2
  const size = nextPowerOf2(seeded.length)
  while (seeded.length < size) seeded.push(null as unknown as string)

  // 3. Build seed positions
  const positions = buildSeedPositions(size)
  const slottedPlayers = positions.map((pos) =>
    pos <= seeded.length ? seeded[pos - 1] : null
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
        player2Id: null,
        nextMatchNumber: null,
        nextMatchSlot: null,
      })
    }
    roundMatches.push(list)
  }

  // Assign first-round players
  const firstRound = roundMatches[0]
  for (let i = 0; i < firstRound.length; i++) {
    firstRound[i].player1Id = slottedPlayers[i * 2] ?? null
    firstRound[i].player2Id = slottedPlayers[i * 2 + 1] ?? null
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
