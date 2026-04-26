import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResultForm } from '@/components/match/ResultForm'
import { MatchStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import type { Match, MatchWithPlayers, Profile } from '@/types/database'

interface PageProps {
  params: { id: string }
}

export default async function MatchPage({ params }: PageProps) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Use admin client so guests can view match details without a session
  const { data: match } = await admin
    .from('matches')
    .select(
      'id, tournament_id, round_id, match_number, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, winner_id, status, screenshot_url, submitted_by, next_match_id, next_match_slot, played_at, created_at, updated_at'
    )
    .eq('id', params.id)
    .single()

  if (!match) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedMatch = match as any as Match & { player1_name?: string | null; player2_name?: string | null }

  const playerIds = [typedMatch.player1_id, typedMatch.player2_id].filter(
    (id): id is string => id !== null
  )

  const { data: profiles } = playerIds.length
    ? await admin
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

  // Resolve display names (registered user profile takes priority over guest name)
  const p1DisplayName = p1?.display_name ?? p1?.username ?? typedMatch.player1_name ?? 'Player 1'
  const p2DisplayName = p2?.display_name ?? p2?.username ?? typedMatch.player2_name ?? 'Player 2'

  const { data: tournament } = await admin
    .from('tournaments')
    .select('title, id, organizer_id')
    .eq('id', typedMatch.tournament_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tournamentData = tournament as any

  const isOrganizer = user?.id === tournamentData?.organizer_id
  const isPlayer =
    user &&
    (typedMatch.player1_id === user.id || typedMatch.player2_id === user.id)

  const canSubmit =
    (isPlayer || isOrganizer) &&
    (typedMatch.status === 'scheduled' || typedMatch.status === 'awaiting_confirmation')

  let screenshotSignedUrl: string | null = null
  if (typedMatch.screenshot_url) {
    const { data: signed } = await admin.storage
      .from('screenshots')
      .createSignedUrl(typedMatch.screenshot_url, 60 * 60)
    screenshotSignedUrl = signed?.signedUrl ?? null
  }

  const { data: round } = await admin
    .from('rounds')
    .select('round_name')
    .eq('id', typedMatch.round_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roundData = round as any

  // Build profile-like objects for ResultForm that include guest names
  const p1ForForm = p1 ?? (typedMatch.player1_name ? { id: '', username: typedMatch.player1_name, display_name: typedMatch.player1_name } : null)
  const p2ForForm = p2 ?? (typedMatch.player2_name ? { id: '', username: typedMatch.player2_name, display_name: typedMatch.player2_name } : null)

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
                name={p1DisplayName}
                score={typedMatch.player1_score}
                isWinner={typedMatch.winner_id === typedMatch.player1_id}
                isCompleted={typedMatch.status === 'completed'}
              />
              <div className="text-2xl font-bold text-gray-400 dark:text-gray-600">vs</div>
              <PlayerDisplay
                profile={p2}
                name={p2DisplayName}
                score={typedMatch.player2_score}
                isWinner={typedMatch.winner_id === typedMatch.player2_id}
                isCompleted={typedMatch.status === 'completed'}
              />
            </div>

            {screenshotSignedUrl && (
              <div className="mb-6">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                  Match Screenshot
                </p>
                <a href={screenshotSignedUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={screenshotSignedUrl}
                    alt="Match screenshot"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-800 object-contain max-h-64"
                  />
                </a>
              </div>
            )}

            {isOrganizer && !isPlayer && canSubmit && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-400 mb-6 text-center">
                Submitting as organizer — result will be applied immediately.
              </div>
            )}

            {typedMatch.status === 'awaiting_confirmation' && isPlayer && (
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
                player1Profile={p1ForForm}
                player2Profile={p2ForForm}
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
  name,
  score,
  isWinner,
  isCompleted,
}: {
  profile: Profile | null
  name: string
  score: number | null
  isWinner: boolean
  isCompleted: boolean
}) {
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
            isWinner ? 'text-brand-500' : 'text-gray-400 dark:text-gray-600'
          }`}
        >
          {score}
        </p>
      )}
    </div>
  )
}
