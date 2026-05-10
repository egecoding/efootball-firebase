import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

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
      />
    )
  }

  return (
    <div className={`h-8 w-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initial}
    </div>
  )
}

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: players } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, wins, losses')
    .order('wins', { ascending: false })
    .order('losses', { ascending: true })
    .limit(100)

  // Fetch last 5 completed matches per player for form dots
  const playerIds = (players ?? []).map((p) => p.id)
  const formMap: Record<string, ('W' | 'L')[]> = {}

  if (playerIds.length > 0) {
    const { data: recentMatches } = await admin
      .from('matches')
      .select('player1_id, player2_id, winner_id, played_at')
      .in('status', ['completed'])
      .or(`player1_id.in.(${playerIds.join(',')}),player2_id.in.(${playerIds.join(',')})`)
      .not('winner_id', 'is', null)
      .order('played_at', { ascending: false })
      .limit(playerIds.length * 5)

    for (const m of recentMatches ?? []) {
      for (const pid of [m.player1_id, m.player2_id]) {
        if (!pid || !playerIds.includes(pid)) continue
        if (!formMap[pid]) formMap[pid] = []
        if (formMap[pid].length < 5) {
          formMap[pid].push(m.winner_id === pid ? 'W' : 'L')
        }
      }
    }
  }

  return (
    <div className="page-container">
      <h1 className="section-title mb-8">🏆 Leaderboard</h1>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
              <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 w-12">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Player</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 w-16">W</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 w-16">L</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 w-20">W%</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 w-28 hidden sm:table-cell">Form</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(players ?? []).map((player, idx) => {
              const rank = idx + 1
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
              const total = (player.wins ?? 0) + (player.losses ?? 0)
              const winRate = total === 0 ? 'N/A' : `${Math.round(((player.wins ?? 0) / total) * 100)}%`
              const displayName = player.display_name ?? player.username ?? 'Unknown'

              return (
                <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    {medal ? (
                      <span className="text-base">{medal}</span>
                    ) : (
                      <span className="text-gray-400 font-mono text-xs">{rank}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/profile/${player.id}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                      <PlayerAvatar name={displayName} avatarUrl={player.avatar_url} />
                      <span className="font-medium text-gray-900 dark:text-white truncate">{displayName}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-green-600 dark:text-green-400">
                    {player.wins ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-red-500 dark:text-red-400">
                    {player.losses ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                    {winRate}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1">
                      {(formMap[player.id] ?? []).map((result, i) => (
                        <span
                          key={i}
                          title={result === 'W' ? 'Win' : 'Loss'}
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${result === 'W' ? 'bg-green-500' : 'bg-red-400'}`}
                        />
                      ))}
                      {(formMap[player.id] ?? []).length === 0 && (
                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {(!players || players.length === 0) && (
          <p className="px-4 py-10 text-center text-gray-400 dark:text-gray-500 text-sm">No players yet.</p>
        )}
      </div>
    </div>
  )
}
