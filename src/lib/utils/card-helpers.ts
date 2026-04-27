/**
 * Shared helpers for winner-card and top-scorer-card API routes.
 */

export interface MatchRow {
  player1_id: string | null
  player1_name: string | null
  player2_id: string | null
  player2_name: string | null
  player1_score: number | null
  player2_score: number | null
}

export interface PlayerStat {
  key: string
  id: string | null
  name: string
  avatarUrl: string | null
  gf: number
  pts: number
  gd: number
  mp: number
}

function rowKey(id: string | null, name: string | null) {
  return id ?? name ?? 'unknown'
}

export function calcStandings(
  matches: MatchRow[],
  format: string,
  profileMap: Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>
): PlayerStat[] {
  const rows = new Map<string, PlayerStat>()

  function getOrCreate(id: string | null, name: string | null): PlayerStat {
    const k = rowKey(id, name)
    if (!rows.has(k)) {
      let displayName = name ?? 'Unknown'
      let avatarUrl: string | null = null
      if (id) {
        const p = profileMap.get(id)
        if (p) {
          displayName = p.display_name ?? p.username ?? displayName
          avatarUrl = p.avatar_url
        }
      }
      rows.set(k, { key: k, id, name: displayName, avatarUrl, gf: 0, pts: 0, gd: 0, mp: 0 })
    }
    return rows.get(k)!
  }

  for (const m of matches) {
    const p1s = m.player1_score ?? 0
    const p2s = m.player2_score ?? 0
    const r1 = getOrCreate(m.player1_id, m.player1_name)
    const r2 = getOrCreate(m.player2_id, m.player2_name)
    r1.mp++; r2.mp++
    r1.gf += p1s; r1.gd += p1s - p2s
    r2.gf += p2s; r2.gd += p2s - p1s
    if (p1s > p2s)      { r1.pts += 3 }
    else if (p2s > p1s) { r2.pts += 3 }
    else { r1.pts += format === 'league' ? 1 : 0; r2.pts += format === 'league' ? 1 : 0 }
  }

  return Array.from(rows.values()).sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.gd !== a.gd ? b.gd - a.gd : b.gf - a.gf
  )
}

export function calcTopScorer(
  matches: MatchRow[],
  profileMap: Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>
): PlayerStat | null {
  const rows = new Map<string, PlayerStat>()

  function getOrCreate(id: string | null, name: string | null): PlayerStat {
    const k = rowKey(id, name)
    if (!rows.has(k)) {
      let displayName = name ?? 'Unknown'
      let avatarUrl: string | null = null
      if (id) {
        const p = profileMap.get(id)
        if (p) {
          displayName = p.display_name ?? p.username ?? displayName
          avatarUrl = p.avatar_url
        }
      }
      rows.set(k, { key: k, id, name: displayName, avatarUrl, gf: 0, pts: 0, gd: 0, mp: 0 })
    }
    return rows.get(k)!
  }

  for (const m of matches) {
    const r1 = getOrCreate(m.player1_id, m.player1_name)
    const r2 = getOrCreate(m.player2_id, m.player2_name)
    r1.mp++; r2.mp++
    r1.gf += m.player1_score ?? 0
    r2.gf += m.player2_score ?? 0
  }

  const sorted = Array.from(rows.values()).sort((a, b) => b.gf - a.gf)
  return sorted[0] ?? null
}

/** Fetch an image URL and return a base64 data URI, or null on failure. */
export async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}
