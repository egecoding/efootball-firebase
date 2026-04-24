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

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
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
          {sorted.map((row, i) => (
            <tr
              key={row.id ?? row.name}
              className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                i === 0 ? 'bg-brand-50/50 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-900'
              }`}
            >
              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.name}</td>
              <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400">{row.P}</td>
              <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400">{row.W}</td>
              {format === 'league' && (
                <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400">{row.D}</td>
              )}
              <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400">{row.L}</td>
              <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400">
                {row.GD > 0 ? `+${row.GD}` : row.GD}
              </td>
              <td className="text-center px-3 py-3 font-bold text-gray-900 dark:text-white">{row.Pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
