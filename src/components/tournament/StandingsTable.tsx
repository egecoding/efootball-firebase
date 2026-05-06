import type { MatchWithPlayers, ParticipantWithProfile, TournamentFormat } from '@/types/database'

interface StandingsTableProps {
  matches: MatchWithPlayers[]
  participants: ParticipantWithProfile[]
  format: TournamentFormat
  groupName?: string
}

interface Row {
  id: string | null
  name: string
  avatarUrl: string | null
  P: number
  W: number
  D: number
  L: number
  GF: number
  GA: number
  GD: number
  Pts: number
}

// Deterministic color from name — gives each guest a unique avatar color
const AVATAR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
]

function nameColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function PlayerAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initial = name.charAt(0).toUpperCase()
  const color = nameColor(name)

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="h-8 w-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-900 shrink-0"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div className={`h-8 w-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-900 shrink-0`}>
      {initial}
    </div>
  )
}

export function StandingsTable({ matches, participants, format, groupName }: StandingsTableProps) {
  const completed = matches.filter((m) => m.status === 'completed')
  if (completed.length === 0) return null

  const rows = new Map<string, Row>()

  function key(id: string | null, name: string | null): string {
    return id ?? name ?? 'unknown'
  }

  function getOrCreate(id: string | null, name: string | null): Row {
    const k = key(id, name)
    if (!rows.has(k)) {
      rows.set(k, { id, name: name ?? id ?? 'Unknown', avatarUrl: null, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 })
    }
    return rows.get(k)!
  }

  // Profile map: user_id → { display_name, username, avatar_url }
  const profileMap = new Map(
    participants
      .filter((p) => p.user_id && p.profiles)
      .map((p) => [p.user_id!, p.profiles!])
  )

  // Name map: for name-only (guest) participants, map name → participant for possible avatar lookup
  function resolveDisplay(id: string | null, rawName: string | null): { name: string; avatarUrl: string | null } {
    if (id) {
      const prof = profileMap.get(id)
      if (prof) return { name: prof.display_name ?? prof.username ?? rawName ?? 'Unknown', avatarUrl: prof.avatar_url }
    }
    return { name: rawName ?? 'Unknown', avatarUrl: null }
  }

  for (const m of completed) {
    const p1s = m.player1_score ?? 0
    const p2s = m.player2_score ?? 0
    const p1 = resolveDisplay(m.player1_id, (m as { player1_name?: string | null }).player1_name ?? null)
    const p2 = resolveDisplay(m.player2_id, (m as { player2_name?: string | null }).player2_name ?? null)

    const r1 = getOrCreate(m.player1_id, p1.name)
    const r2 = getOrCreate(m.player2_id, p2.name)
    r1.name = p1.name; r1.avatarUrl = p1.avatarUrl
    r2.name = p2.name; r2.avatarUrl = p2.avatarUrl

    r1.P++; r2.P++
    r1.GF += p1s; r1.GA += p2s; r1.GD = r1.GF - r1.GA
    r2.GF += p2s; r2.GA += p1s; r2.GD = r2.GF - r2.GA

    if (p1s > p2s) {
      r1.W++; r2.L++
      r1.Pts += 3
    } else if (p2s > p1s) {
      r2.W++; r1.L++
      r2.Pts += 3
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

  type Zone = 'champion' | 'top' | 'playoff' | 'relegation' | 'neutral'

  function getZone(i: number): Zone {
    if (n <= 2) return i === 0 ? 'champion' : 'neutral'
    if (i === 0) return 'champion'
    if (n <= 4) return i < 2 ? 'top' : 'neutral'
    if (i < 3) return 'top'
    if (i <= 4) return 'playoff'
    if (i >= n - 2) return 'relegation'
    return 'neutral'
  }

  const zoneConfig: Record<Zone, { bg: string; border: string; pos: string; label: string; dot: string }> = {
    champion: {
      bg: 'bg-amber-50 dark:bg-amber-900/25',
      border: 'border-l-4 border-l-amber-400',
      pos: 'text-amber-500 font-extrabold',
      label: '🥇 Champion',
      dot: 'bg-amber-400',
    },
    top: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-l-4 border-l-green-500',
      pos: 'text-green-600 dark:text-green-400 font-bold',
      label: '🏆 Promotion',
      dot: 'bg-green-500',
    },
    playoff: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-l-4 border-l-blue-500',
      pos: 'text-blue-600 dark:text-blue-400 font-bold',
      label: '⚔️ Playoff',
      dot: 'bg-blue-500',
    },
    relegation: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-l-4 border-l-red-500',
      pos: 'text-red-500 dark:text-red-400 font-bold',
      label: '⬇️ Relegation',
      dot: 'bg-red-500',
    },
    neutral: {
      bg: 'bg-white dark:bg-gray-900',
      border: 'border-l-4 border-l-transparent',
      pos: 'text-gray-400',
      label: '',
      dot: 'bg-gray-400',
    },
  }

  // Position medals for top 3
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* Table header row */}
      {groupName && (
        <div className="px-4 py-2.5 bg-brand-500/10 border-b border-brand-500/20 flex items-center gap-2">
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">Group {groupName}</span>
        </div>
      )}

      {/* Legend */}
      {n >= 4 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-800 flex-wrap text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Champion</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" /> Promotion</span>
          {n >= 6 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Playoff</span>}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Relegation</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80">
              <th className="text-left px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 w-8">#</th>
              <th className="text-left px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Club / Player</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-500 dark:text-gray-400 text-xs">P</th>
              <th className="text-center px-2 py-3 font-semibold text-green-600 dark:text-green-400 text-xs">W</th>
              {format === 'league' && (
                <th className="text-center px-2 py-3 font-semibold text-gray-400 text-xs">D</th>
              )}
              <th className="text-center px-2 py-3 font-semibold text-red-500 dark:text-red-400 text-xs">L</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">GF</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">GA</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-500 dark:text-gray-400 text-xs">GD</th>
              <th className="text-center px-3 py-3 font-bold text-gray-900 dark:text-white text-xs w-12">PTS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const zone = getZone(i)
              const cfg = zoneConfig[zone]
              const isZoneStart = i > 0 && getZone(i - 1) !== zone

              return (
                <tr
                  key={row.id ?? row.name}
                  className={`border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors hover:brightness-95 dark:hover:brightness-110 ${cfg.bg} ${cfg.border} ${isZoneStart ? 'border-t-2 border-t-gray-200 dark:border-t-gray-700' : ''}`}
                >
                  {/* Position */}
                  <td className={`px-3 py-3 tabular-nums text-center ${cfg.pos}`}>
                    {i < 3 ? <span className="text-base leading-none">{medals[i]}</span> : <span className="text-xs font-bold">{i + 1}</span>}
                  </td>

                  {/* Player — avatar + name */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar name={row.name} avatarUrl={row.avatarUrl} />
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-900 dark:text-white truncate block">{row.name}</span>
                        {zone !== 'neutral' && (
                          <span className={`text-[10px] font-medium ${cfg.pos} hidden sm:block`}>{cfg.label}</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Stats */}
                  <td className="text-center px-2 py-3 text-gray-600 dark:text-gray-400 tabular-nums text-xs">{row.P}</td>
                  <td className="text-center px-2 py-3 tabular-nums text-xs font-semibold text-green-600 dark:text-green-400">{row.W}</td>
                  {format === 'league' && (
                    <td className="text-center px-2 py-3 text-gray-500 dark:text-gray-500 tabular-nums text-xs">{row.D}</td>
                  )}
                  <td className="text-center px-2 py-3 tabular-nums text-xs font-medium text-red-500 dark:text-red-400">{row.L}</td>
                  <td className="text-center px-2 py-3 text-gray-600 dark:text-gray-400 tabular-nums text-xs hidden sm:table-cell">{row.GF}</td>
                  <td className="text-center px-2 py-3 text-gray-600 dark:text-gray-400 tabular-nums text-xs hidden sm:table-cell">{row.GA}</td>
                  <td className={`text-center px-2 py-3 tabular-nums text-xs font-bold ${
                    row.GD > 0 ? 'text-green-600 dark:text-green-400' :
                    row.GD < 0 ? 'text-red-500 dark:text-red-400' :
                    'text-gray-400'
                  }`}>
                    {row.GD > 0 ? `+${row.GD}` : row.GD}
                  </td>
                  <td className="text-center px-3 py-3 tabular-nums">
                    <span className={`inline-flex items-center justify-center h-7 w-8 rounded-lg text-sm font-extrabold ${
                      zone === 'champion' ? 'bg-amber-400 text-amber-900' :
                      zone === 'top'      ? 'bg-green-500 text-white' :
                      zone === 'playoff'  ? 'bg-blue-500 text-white' :
                      zone === 'relegation' ? 'bg-red-500 text-white' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    }`}>
                      {row.Pts}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
