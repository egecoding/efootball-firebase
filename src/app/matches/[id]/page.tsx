import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ResultForm } from '@/components/match/ResultForm'
import { MatchStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import type { Match, MatchWithPlayers, Profile } from '@/types/database'

interface PageProps {
  params: { id: string }
}

export default async function MatchPage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: match } = await supabase
    .from('matches')
    .select(
      'id, tournament_id, round_id, match_number, player1_id, player2_id, player1_score, player2_score, winner_id, status, screenshot_url, submitted_by, next_match_id, next_match_slot, played_at, created_at, updated_at'
    )
    .eq('id', params.id)
    .single()

  if (!match) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedMatch = match as any as Match

  const playerIds = [typedMatch.player1_id, typedMatch.player2_id].filter(
    (id): id is string => id !== null
  )

  const { data: profiles } = playerIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, wins, losses, created_at, updated_at')
        .in('id', playerIds)
    : { data: [] }

  const profileMap: Record<string, Profile> = {}
  for (const p of (profiles ?? []) as unknown as Profile[]) {
    profileMap[p.id] = p
  }

  const p1 = typedMatch.player1_id ? profileMap[typedMatch.player1_id] ?? null : null
  const p2 = typedMatch.player2_id ? profileMap[typedMatch.player2_id] ?? null : null

  const isPlayer =
    user &&
    (typedMatch.player1_id === user.id || typedMatch.player2_id === user.id)

  const canSubmit =
    isPlayer &&
    (typedMatch.status === 'scheduled' || typedMatch.status === 'awaiting_confirmation')

  const { data: round } = await supabase
    .from('rounds')
    .select('round_name')
    .eq('id', typedMatch.round_id)
    .single()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('title, id')
    .eq('id', typedMatch.tournament_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roundData = round as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tournamentData = tournament as any

  return (
    <div className="page-container">
      <div className="max-w-lg mx-auto">
        {tournamentData && (
          <Link
            href={`/tournaments/${tournamentData.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            {tournamentData.title}
          </Link>
        )}

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                {roundData?.round_name ?? 'Match'}
              </p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Match #{typedMatch.match_number}
              </p>
            </div>
            <MatchStatusBadge status={typedMatch.status} />
          </div>

          <div className="px-6 py-6">
            <div className="flex items-center justify-center gap-6 mb-8">
              <PlayerDisplay
                profile={p1}
                score={typedMatch.player1_score}
                isWinner={typedMatch.winner_id === typedMatch.player1_id}
                isCompleted={typedMatch.status === 'completed'}
              />
              <div className="text-2xl font-bold text-gray-400 dark:text-gray-600">
                vs
              </div>
              <PlayerDisplay
                profile={p2}
                score={typedMatch.player2_score}
                isWinner={typedMatch.winner_id === typedMatch.player2_id}
                isCompleted={typedMatch.status === 'completed'}
              />
            </div>

            {typedMatch.status === 'awaiting_confirmation' && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400 mb-6 text-center">
                Waiting for the other player to confirm the score.
              </div>
            )}

            {typedMatch.played_at && typedMatch.status === 'completed' && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-500 mb-6">
                Played on {new Date(typedMatch.played_at).toLocaleString()}
              </p>
            )}

            {canSubmit && user ? (
              <ResultForm
                match={typedMatch as unknown as MatchWithPlayers}
                currentUserId={user.id}
                player1Profile={p1}
                player2Profile={p2}
              />
            ) : !user ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                <Link
                  href={`/auth/login?redirectTo=/matches/${params.id}`}
                  className="text-brand-500 hover:text-brand-600"
                >
                  Sign in
                </Link>{' '}
                to submit results.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlayerDisplay({
  profile,
  score,
  isWinner,
  isCompleted,
}: {
  profile: Profile | null
  score: number | null
  isWinner: boolean
  isCompleted: boolean
}) {
  const name = profile?.display_name ?? profile?.username ?? 'TBD'

  return (
    <div
      className={`flex flex-col items-center gap-2 flex-1 ${
        isCompleted && !isWinner ? 'opacity-50' : ''
      }`}
    >
      <Avatar src={profile?.avatar_url} name={name} size="lg" />
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 text-center max-w-[100px] truncate">
        {name}
      </p>
      {score !== null && (
        <p
          className={`text-3xl font-extrabold tabular-nums ${
            isWinner
              ? 'text-brand-500'
              : 'text-gray-400 dark:text-gray-600'
          }`}
        >
          {score}
        </p>
      )}
    </div>
  )
}
