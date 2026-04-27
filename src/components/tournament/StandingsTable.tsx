import type { MatchWithPlayers, ParticipantWithProfile, TournamentFormat } from '@/types/database'

interface StandingsTableProps {
  matches: MatchWithPlayers[]
  participants: ParticipantWithProfile[]
  format: TournamentFormat
}

interface Row {
  id: string | null
  name: string
  P: number
  W: number
  D: number
  L: number
  GF: number
  GA: number
  GD: number
  Pts: number
}

export function StandingsTable({ matches, participants, format }: StandingsTableProps) {
  const completed = matches.filter((m) => m.status === 'completed')
  if (completed.length === 0) return null

  // Build a map of participant id/name → row
  const rows = new Map<string, Row>()

  function key(id: string | null, name: string | null): string {
    return id ?? name ?? 'unknown'
  }

  function getOrCreate(id: string | null, name: string | null): Row {
    const k = key(id, name)
    if (!rows.has(k)) {
      rows.set(k, { id, name: name ?? id ?? 'Unknown', P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 })
    }
    return rows.get(k)!
  }

  // Resolve display name for registered users
  const profileMap = new Map(participants.map((p) => [p.user_id ?? '', p.profiles]))

  function displayName(id: string | null, name: string | null): string {
    if (id) {
      const profile = profileMap.get(id)
      if (profile) return profile.display_name ?? profile.username
    }
    return name ?? 'Unknown'
  }

  for (const m of completed) {
    const p1s = m.player1_score ?? 0
    const p2s = m.player2_score ?? 0
    const p1Name = displayName(m.player1_id, (m as { player1_name?: string | null }).player1_name ?? null)
    const p2Name = displayName(m.player2_id, (m as { player2_name?: string | null }).player2_name ?? null)

    const r1 = getOrCreate(m.player1_id, p1Name)
    const r2 = getOrCreate(m.player2_id, p2Name)
    // Update names to resolved display names
    r1.name = p1Name
    r2.name = p2Name

    r1.P++; r2.P++
    r1.GF += p1s; r1.GA += p2s; r1.GD = r1.GF - r1.GA
    r2.GF += p2s; r2.GA += p1s; r2.GD = r2.GF - r2.GA

    if (p1s > p2s) {
      r1.W++; r2.L++
      r1.Pts += format === 'league' ? 3 : 3
    } else if (p2s > p1s) {
      r2.W++; r1.L++
      r2.Pts += format === 'league' ? 3 : 3
    } else {
      r1.D++; r2.D++
      r1.Pts += format === 'league' ? 1 : 0
      r2.Pts += format === 'league' ? 1 : 0
    }
  }

  const sorted = Array.from(rows.values()).sort((a, b) =>
    b.Pts !== a.Pts ? b.Pts - a.Pts : b.GD !== a.GD ? b.GD - a.GD : b.GF - a.GF
  )

  const n = sorted.length

  function getZone(i: number): 'top' | 'mid-top' | 'relegation' | 'neutral' {
    if (n <= 3) {
      // Small table: only color if enough players
      if (i === 0) return 'top'
      return 'neutral'
    }
    // Top 3 = green (Champions / Promotion)
    if (i < 3) return 'top'
    // 4th and 5th = blue (Playoff)
    if (i === 3 || i === 4) return 'mid-top'
    // Bottom 2 = red (Relegation)
    if (i >= n - 2) return 'relegation'
    return 'neutral'
  }

  const zoneLabel: Record<string, string> = {
    top: 'Championship',
    'mid-top': 'Playoff',
    relegation: 'Relegation',
  }

  // Track zone boundary rows for separator lines
  const zones = sorted.map((_, i) => getZone(i))

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
      {/* Legend */}
      {n >= 4 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-800 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="h-2.5 w-2.5 rounded-sm bg-green-500/80" /> Top 3 · Promotion
          </span>
          {n >= 6 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/80" /> 4th–5th · Playoff
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500/80" /> Bottom 2 · Relegation
          </span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Player</th>
            <th className="text-center px-3 py-3 font-medium text-gray-500 dark:text-gray-400">P</th>
            <th className="text-center px-3 py-3 font-medium text-gray-500 dark:text-gray-400">W</th>
            {format === 'league' && (
              <th className="text-center px-3 py-3 font-medium text-gray-500 dark:text-gray-400">D</th>
            )}
            <th className="text-center px-3 py-3 font-medium text-gray-500 dark:text-gray-400">L</th>
            <th className="text-center px-3 py-3 font-medium text-gray-500 dark:text-gray-400">GD</th>
            <th className="text-center px-3 py-3 font-bold text-gray-700 dark:text-gray-200">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const zone = getZone(i)
            const isZoneStart = i === 0 || getZone(i - 1) !== zone

            const rowBg =
              zone === 'top'        ? 'bg-green-100 dark:bg-green-900/40' :
              zone === 'mid-top'    ? 'bg-blue-100 dark:bg-blue-900/40' :
              zone === 'relegation' ? 'bg-red-100 dark:bg-red-900/40' :
                                      'bg-white dark:bg-gray-900'

            const posColor =
              zone === 'top'        ? 'text-green-600 dark:text-green-400 font-bold' :
              zone === 'mid-top'    ? 'text-blue-600 dark:text-blue-400 font-bold' :
              zone === 'relegation' ? 'text-red-500 dark:text-red-400 font-bold' :
                                      'text-gray-400'

            const leftBorder =
              zone === 'top'        ? 'border-l-4 border-l-green-500' :
              zone === 'mid-top'    ? 'border-l-4 border-l-blue-500' :
              zone === 'relegation' ? 'border-l-4 border-l-red-500' :
                                      'border-l-4 border-l-transparent'

            const topBorder = isZoneStart && i !== 0 ? 'border-t-2 border-t-gray-200 dark:border-t-gray-700' : ''

            return (
              <tr
                key={row.id ?? row.name}
                className={`border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors ${rowBg} ${leftBorder} ${topBorder}`}
              >
                <td className={`px-4 py-3 font-mono text-xs tabular-nums ${posColor}`}>{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{row.name}</span>
                    {i === 0 && <span className="text-xs">🏆</span>}
                  </div>
                </td>
                <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400 tabular-nums">{row.P}</td>
                <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400 tabular-nums">{row.W}</td>
                {format === 'league' && (
                  <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400 tabular-nums">{row.D}</td>
                )}
                <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400 tabular-nums">{row.L}</td>
                <td className={`text-center px-3 py-3 tabular-nums font-medium ${row.GD > 0 ? 'text-green-600 dark:text-green-400' : row.GD < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                  {row.GD > 0 ? `+${row.GD}` : row.GD}
                </td>
                <td className="text-center px-3 py-3 font-extrabold text-gray-900 dark:text-white tabular-nums">{row.Pts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
