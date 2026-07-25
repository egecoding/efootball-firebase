import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Users, Calendar, Trophy, Settings, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/site'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { BracketView } from '@/components/tournament/BracketView'
import { ScheduleView } from '@/components/tournament/ScheduleView'
import { StandingsTable } from '@/components/tournament/StandingsTable'
import { ParticipantList } from '@/components/tournament/ParticipantList'
import { CardDownloadButtons } from '@/components/tournament/CardDownloadButtons'
import { AnnouncementBanner } from '@/components/tournament/AnnouncementBanner'
import { RealtimeRefresh } from '@/components/tournament/RealtimeRefresh'
import { HomeAwayBracketView } from '@/components/tournament/HomeAwayBracketView'
import { TournamentStats } from '@/components/tournament/TournamentStats'
import { TopScorersTable } from '@/components/tournament/TopScorersTable'
import { calcStandings, calcTopScorer, type MatchRow } from '@/lib/utils/card-helpers'
import type { TournamentWithOrganizer, ParticipantWithProfile, RoundWithMatches, MatchWithPlayers, Profile } from '@/types/database'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('title, description, game_name, format, status')
    .eq('id', params.id)
    .single()

  if (!tournament) return { title: 'Tournament not found — eFootball Cup' }

  const title = `${tournament.title} — eFootball Cup`
  const description =
    tournament.description ??
    `${tournament.game_name} ${tournament.format.replace(/_/g, ' ')} tournament on eFootball Cup. Join brackets, track live results, and compete for free.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/tournaments/${params.id}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: tournament }, { data: participants }, { data: rounds }] =
    await Promise.all([
      supabase
        .from('tournaments')
        .select(
          'id, organizer_id, title, description, game_name, max_participants, status, format, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
        )
        .eq('id', params.id)
        .single(),
      supabase
        .from('participants')
        .select(
          'id, tournament_id, user_id, name, seed, joined_at, profiles(id, username, display_name, avatar_url, wins, losses, created_at, updated_at)'
        )
        .eq('tournament_id', params.id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('rounds')
        .select(
          'id, tournament_id, round_number, round_name, phase, matches(id, tournament_id, round_id, match_number, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, winner_id, status, screenshot_url, submitted_by, next_match_id, next_match_slot, played_at, created_at, updated_at, group_name, bracket, tie_id, leg)'
        )
        .eq('tournament_id', params.id)
        .order('round_number', { ascending: true }),
    ])

  if (!tournament) notFound()

  const typedTournament = tournament as unknown as TournamentWithOrganizer
  const organizer = typedTournament.profiles
  const isOrganizer = user?.id === tournament.organizer_id
  const isParticipant = participants?.some((p) => p.user_id === user?.id)

  // Build a profile map from participants for use in BracketView
  const profileMap: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>> = {}
  if (participants) {
    for (const p of participants) {
      if (p.profiles && p.user_id) {
        const prof = p.profiles as unknown as Profile
        profileMap[p.user_id] = {
          id: prof.id,
          username: prof.username,
          display_name: prof.display_name,
          avatar_url: prof.avatar_url,
        }
      }
    }
  }

  // Find the logged-in player's active match (scheduled or awaiting confirmation)
  type RawMatch = {
    id: string
    match_number: number
    player1_id: string | null
    player1_name: string | null
    player2_id: string | null
    player2_name: string | null
    player1_score: number | null
    player2_score: number | null
    winner_id?: string | null
    status: string
    tie_id?: string | null
    leg?: number | null
  }
  const allMatches: RawMatch[] = (rounds ?? []).flatMap(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => (r.matches ?? []) as RawMatch[]
  )
  const myActiveMatch = user
    ? allMatches.find(
        (m) =>
          (m.player1_id === user.id || m.player2_id === user.id) &&
          (m.status === 'scheduled' || m.status === 'awaiting_confirmation')
      ) ?? null
    : null

  const opponentName = myActiveMatch
    ? myActiveMatch.player1_id === user?.id
      ? (myActiveMatch.player2_name ?? profileMap[myActiveMatch.player2_id ?? '']?.display_name ?? profileMap[myActiveMatch.player2_id ?? '']?.username ?? 'Opponent')
      : (myActiveMatch.player1_name ?? profileMap[myActiveMatch.player1_id ?? '']?.display_name ?? profileMap[myActiveMatch.player1_id ?? '']?.username ?? 'Opponent')
    : null

  // ── Card download eligibility ──
  const tournamentFormat = (typedTournament as unknown as { format?: string }).format ?? 'knockout'

  // For home_away_knockout: find partner leg 1 if active match is leg 2
  const partnerLeg1ForCta = tournamentFormat === 'home_away_knockout' && myActiveMatch && (myActiveMatch as RawMatch & { leg?: number | null; tie_id?: string | null }).leg === 2
    ? allMatches.find((m) => {
        const rm = m as RawMatch & { tie_id?: string | null; leg?: number | null }
        return rm.tie_id === (myActiveMatch as RawMatch & { tie_id?: string | null }).tie_id && rm.leg === 1
      }) ?? null
    : null

  // ── Per-group standings (group_knockout) ──
  type GroupMatch = RawMatch & { group_name?: string | null; bracket?: string | null }
  const groupMatchesByGroup = new Map<string, GroupMatch[]>()
  if (tournamentFormat === 'group_knockout') {
    for (const m of allMatches as GroupMatch[]) {
      if (m.group_name && m.status === 'completed') {
        const arr = groupMatchesByGroup.get(m.group_name) ?? []
        arr.push(m)
        groupMatchesByGroup.set(m.group_name, arr)
      }
    }
  }

  // ── CL league-phase matches ──
  const clLeagueMatches = tournamentFormat === 'champions_league'
    ? (allMatches as GroupMatch[]).filter((m) => m.bracket === 'league')
    : []
  const completedMatches: MatchRow[] = allMatches.filter(
    (m) => (m as unknown as { status?: string }).status === 'completed'
  ) as unknown as MatchRow[]

  // Build profileMap for card-helpers (different shape from the local profileMap above)
  const cardProfileMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>()
  for (const p of participants ?? []) {
    if (p.user_id && p.profiles) {
      const prof = p.profiles as unknown as { username: string | null; display_name: string | null; avatar_url: string | null }
      cardProfileMap.set(p.user_id, { display_name: prof.display_name, username: prof.username, avatar_url: prof.avatar_url })
    }
  }

  let winnerId: string | null = null
  if (tournament.status === 'completed') {
    if (tournamentFormat === 'knockout' || tournamentFormat === 'home_away_knockout') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sortedRounds = [...(rounds ?? [])].sort((a: any, b: any) => b.round_number - a.round_number)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // Include walkovers: a final decided by forfeit still has a champion, but
      // filtering to 'completed' left winnerId null — no crown, and the winner-card
      // download stayed hidden even though matches.winner_id was populated.
      const finalMatch = (sortedRounds[0] as any)?.matches?.find(
        (m: any) => (m.status === 'completed' || m.status === 'walkover') && m.winner_id
      )
      winnerId = finalMatch?.winner_id ?? null
    } else {
      const standings = calcStandings(completedMatches, tournamentFormat, cardProfileMap)
      winnerId = standings[0]?.id ?? null
    }
  }

  const topScorer = tournament.status === 'completed'
    ? calcTopScorer(completedMatches, cardProfileMap)
    : null
  const topScorerId = topScorer?.id ?? null

  const isWinner = !!user && !!winnerId && user.id === winnerId
  const isTopScorer = !!user && !!topScorerId && user.id === topScorerId
  // Show cards only to organizer, winner, or top scorer
  const showCards = tournament.status === 'completed' && (isOrganizer || isWinner || isTopScorer)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: tournament.title,
    description: tournament.description ?? `${tournament.game_name} tournament on eFootball Cup`,
    url: `${SITE_URL}/tournaments/${tournament.id}`,
    sport: tournament.game_name,
    eventStatus:
      tournament.status === 'completed'
        ? 'https://schema.org/EventCompleted'
        : tournament.status === 'in_progress'
          ? 'https://schema.org/EventScheduled'
          : 'https://schema.org/EventScheduled',
    ...(tournament.starts_at ? { startDate: tournament.starts_at } : {}),
    ...(organizer
      ? { organizer: { '@type': 'Person', name: organizer.display_name ?? organizer.username } }
      : {}),
    maximumAttendeeCapacity: tournament.max_participants,
  }

  return (
    <div className="page-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RealtimeRefresh tournamentId={tournament.id} />
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="section-title">{tournament.title}</h1>
              <TournamentStatusBadge status={tournament.status} />
            </div>
            {tournament.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                {tournament.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                {tournament.game_name}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {participants?.length ?? 0} / {tournament.max_participants} players
              </span>
              {tournament.starts_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(tournament.starts_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {isOrganizer && (
              <Link
                href={`/tournaments/${params.id}/manage`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Manage
              </Link>
            )}
            {!isParticipant && !isOrganizer && tournament.status === 'open' && user && (
              <Link
                href={`/tournaments/${params.id}/join`}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                Join Tournament
              </Link>
            )}
          </div>
        </div>

        {/* Card previews — organizer, winner, or top scorer only */}
        {showCards && (
          <div className="mt-8">
            <CardDownloadButtons
              tournamentId={params.id}
              showWinner={isOrganizer || isWinner}
              showTopScorer={isOrganizer || isTopScorer}
            />
          </div>
        )}

        {/* Organizer */}
        <div className="flex items-center gap-2 mt-4">
          <Avatar
            src={organizer?.avatar_url}
            name={organizer?.display_name ?? organizer?.username}
            size="sm"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Organized by{' '}
            <Link
              href={`/profile/${organizer?.id}`}
              className="font-medium text-gray-700 dark:text-gray-300 hover:text-brand-500"
            >
              {organizer?.display_name ?? organizer?.username}
            </Link>
          </span>
        </div>
      </div>

      {/* Announcements */}
      <div className="mb-6">
        <AnnouncementBanner tournamentId={tournament.id} isOrganizer={isOrganizer} />
      </div>

      {/* ── Your Match CTA ── shown to logged-in players with an active match */}
      {myActiveMatch && (
        <div className="mb-8 rounded-xl border border-brand-400/40 dark:border-brand-600/40 bg-brand-50 dark:bg-brand-900/20 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                  Your Match — {myActiveMatch.status === 'awaiting_confirmation' ? 'Awaiting Confirmation' : 'Ready to Play'}
                </span>
              </div>
              {tournamentFormat === 'home_away_knockout' && (myActiveMatch as { tie_id?: string | null }).tie_id && (
                <div className="mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider">
                    {(myActiveMatch as { leg?: number | null }).leg === 1 ? 'Leg 1 of 2' : 'Leg 2 of 2'}
                  </span>
                  {(myActiveMatch as { leg?: number | null }).leg === 2 && partnerLeg1ForCta && (partnerLeg1ForCta as { player1_score?: number | null }).player1_score !== null && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      (Leg 1: {(partnerLeg1ForCta as { player1_score?: number | null; player2_score?: number | null }).player1_score}–{(partnerLeg1ForCta as { player1_score?: number | null; player2_score?: number | null }).player2_score})
                    </span>
                  )}
                </div>
              )}
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Match #{myActiveMatch.match_number} · vs{' '}
                <span className="text-brand-600 dark:text-brand-400">{opponentName}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Play your match, then submit the score and upload a screenshot for the organizer.
              </p>
            </div>
            <Link
              href={`/matches/${myActiveMatch.id}`}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <Upload className="h-4 w-4" />
              Submit Result &amp; Screenshot
            </Link>
          </div>
        </div>
      )}

      {/* Bracket / Schedule */}
      {rounds && rounds.length > 0 ? (
        <div className="mb-10">
          {tournamentFormat === 'knockout' || tournamentFormat === 'double_elimination' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bracket</h2>
              <BracketView
                rounds={rounds as unknown as RoundWithMatches[]}
                currentUserId={user?.id}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
              />
            </>
          ) : tournamentFormat === 'home_away_knockout' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bracket</h2>
              <HomeAwayBracketView
                rounds={rounds as unknown as RoundWithMatches[]}
                profileMap={profileMap}
                currentUserId={user?.id}
                organizerId={tournament.organizer_id}
              />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">Schedule</h2>
              <ScheduleView
                rounds={rounds as unknown as RoundWithMatches[]}
                currentUserId={user?.id}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
                format={tournamentFormat}
              />
            </>
          ) : tournamentFormat === 'group_knockout' ? (
            <>
              {/* Per-group standings */}
              {groupMatchesByGroup.size > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Group Standings</h2>
                  <div className="flex flex-col gap-4">
                    {Array.from(groupMatchesByGroup.entries())
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([groupName, gMatches]) => {
                        const advancePerGroup = gMatches.length <= 1 ? 1 : 2
                        return (
                          <div key={groupName} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">Group {groupName}</span>
                              <span className="text-xs text-gray-400">Top {advancePerGroup} advance</span>
                            </div>
                            <StandingsTable
                              matches={gMatches as unknown as MatchWithPlayers[]}
                              participants={participants as unknown as ParticipantWithProfile[]}
                              format="round_robin"
                            />
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule</h2>
              <ScheduleView
                rounds={rounds as unknown as RoundWithMatches[]}
                currentUserId={user?.id}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
                format={tournamentFormat}
              />
            </>
          ) : tournamentFormat === 'champions_league' ? (
            <>
              {/* CL league-phase table */}
              {clLeagueMatches.length > 0 && participants && participants.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">League Standings</h2>
                  <StandingsTable
                    matches={clLeagueMatches as unknown as MatchWithPlayers[]}
                    participants={participants as unknown as ParticipantWithProfile[]}
                    format="league"
                  />
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule</h2>
              <ScheduleView
                rounds={rounds as unknown as RoundWithMatches[]}
                currentUserId={user?.id}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
                format={tournamentFormat}
              />
            </>
          ) : (
            <>
              {/* round_robin / league */}
              {participants && participants.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Standings</h2>
                  <StandingsTable
                    matches={(rounds as unknown as RoundWithMatches[]).flatMap((r) => r.matches) as unknown as MatchWithPlayers[]}
                    participants={participants as unknown as ParticipantWithProfile[]}
                    format={tournamentFormat as 'round_robin' | 'league'}
                  />
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule</h2>
              <ScheduleView
                rounds={rounds as unknown as RoundWithMatches[]}
                currentUserId={user?.id}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
                format={tournamentFormat}
              />
            </>
          )}
        </div>
      ) : (
        tournament.status === 'open' && (
          <div className="mb-10 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <p className="text-gray-400 dark:text-gray-500">
              {tournamentFormat === 'knockout' || tournamentFormat === 'double_elimination' || tournamentFormat === 'home_away_knockout'
                ? 'Bracket will appear once the organizer starts the tournament.'
                : 'Schedule and standings will appear once the organizer starts the tournament.'}
            </p>
          </div>
        )
      )}

      {/* Top Scorers — show once tournament is in progress or completed */}
      {tournament.status !== 'open' && allMatches.length > 0 && (
        <div className="mb-8">
          <TopScorersTable
            matches={allMatches.map((m) => ({
              id: m.id,
              player1_id: m.player1_id,
              player1_name: m.player1_name,
              player2_id: m.player2_id,
              player2_name: m.player2_name,
              player1_score: m.player1_score,
              player2_score: m.player2_score,
              status: m.status,
            }))}
            profileMap={Object.fromEntries(
              Array.from(cardProfileMap.entries()).map(([k, v]) => [k, { display_name: v.display_name, username: v.username, avatar_url: v.avatar_url }])
            )}
          />
        </div>
      )}

      {/* Tournament Stats — only show for completed tournaments */}
      {tournament.status === 'completed' && (
        <div className="mb-8">
          <TournamentStats
            matches={allMatches.map((m) => ({
              id: m.id,
              player1_id: m.player1_id,
              player1_name: m.player1_name,
              player2_id: m.player2_id,
              player2_name: m.player2_name,
              player1_score: m.player1_score,
              player2_score: m.player2_score,
              winner_id: m.winner_id,
              status: m.status,
            }))}
            profileMap={Object.fromEntries(
              Array.from(cardProfileMap.entries()).map(([k, v]) => [k, { display_name: v.display_name, username: v.username }])
            )}
            winnerName={winnerId ? (cardProfileMap.get(winnerId)?.display_name ?? cardProfileMap.get(winnerId)?.username ?? null) : null}
          />
        </div>
      )}

      {/* Participants */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Participants ({participants?.length ?? 0})
        </h2>
        <ParticipantList
          participants={(participants as unknown as ParticipantWithProfile[]) ?? []}
          organizerId={tournament.organizer_id}
          currentUserId={user?.id}
          tournamentId={params.id}
        />
      </div>
    </div>
  )
}
