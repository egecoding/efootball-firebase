'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Trophy, Users, Calendar, Upload, CheckCircle, Clock, ImagePlus, X, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import { GuestPushPrompt } from '@/components/layout/GuestPushPrompt'
import { SaveLinkBanner } from '@/components/layout/SaveLinkBanner'
import { BracketView } from '@/components/tournament/BracketView'
import { ScheduleView } from '@/components/tournament/ScheduleView'
import { HomeAwayBracketView } from '@/components/tournament/HomeAwayBracketView'
import { StandingsTable } from '@/components/tournament/StandingsTable'
import { ParticipantList } from '@/components/tournament/ParticipantList'
import { CardDownloadButtons } from '@/components/tournament/CardDownloadButtons'
import { TopScorersTable } from '@/components/tournament/TopScorersTable'
import { PredictionBar } from '@/components/match/PredictionBar'
import { DisputeButton } from '@/components/match/DisputeButton'
import { useScreenshotScore } from '@/hooks/useScreenshotScore'
import { calcTopScorer } from '@/lib/utils/card-helpers'
import type {
  TournamentWithOrganizer,
  ParticipantWithProfile,
  RoundWithMatches,
  MatchWithPlayers,
  Profile,
} from '@/types/database'

interface PlayerPortalProps {
  tournament: TournamentWithOrganizer
  participants: ParticipantWithProfile[]
  rounds: RoundWithMatches[]
  profileMap: Record<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
  currentUserId: string | null
  userParticipantId: string | null
  tournamentId: string
}

type ActiveMatch = {
  id: string
  match_number: number
  player1_id: string | null
  player1_name: string | null
  player2_id: string | null
  player2_name: string | null
  status: string
  tie_id?: string | null
  leg?: number | null
}

export function PlayerPortal({
  tournament,
  participants,
  rounds,
  profileMap,
  currentUserId,
  userParticipantId,
  tournamentId,
}: PlayerPortalProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Resolve identity: prefer server-supplied (logged-in user), fall back to URL ?pid= or localStorage (guest)
  const [participantId, setParticipantId] = useState<string | null>(userParticipantId)
  const [myName, setMyName] = useState<string | null>(null)
  const [myMatch, setMyMatch] = useState<ActiveMatch | null>(null)

  // Score form state
  const [p1Score, setP1Score] = useState('')
  const [p2Score, setP2Score] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

  // Resolved so the OCR can attribute each score to the right player instead of
  // guessing by position — same name-resolution order used elsewhere in this file.
  const resolvedPlayer1Name = myMatch
    ? myMatch.player1_name ?? profileMap[myMatch.player1_id ?? '']?.display_name ?? profileMap[myMatch.player1_id ?? '']?.username ?? null
    : null
  const resolvedPlayer2Name = myMatch
    ? myMatch.player2_name ?? profileMap[myMatch.player2_id ?? '']?.display_name ?? profileMap[myMatch.player2_id ?? '']?.username ?? null
    : null

  // Screenshot state — read client-side with Tesseract.js (free, no external API)
  const { uploadStatus, uploadFileName, screenshotPath, aiNotice, fileRef, handleFile, clear: clearScreenshot } = useScreenshotScore({
    matchId: myMatch?.id ?? null,
    participantId,
    currentUserId,
    player1Name: resolvedPlayer1Name,
    player2Name: resolvedPlayer2Name,
    onScoreDetected: (p1, p2) => {
      setP1Score(String(p1))
      setP2Score(String(p2))
    },
  })

  useEffect(() => {
    let pid = participantId

    if (!pid) {
      // Check URL ?pid= first (guest returning via personal link)
      const urlPid = searchParams.get('pid')
      if (urlPid) {
        pid = urlPid
        localStorage.setItem(`participant_${tournamentId}`, urlPid)
        setParticipantId(urlPid)
        // Strip pid from URL without reloading
        const url = new URL(window.location.href)
        url.searchParams.delete('pid')
        window.history.replaceState({}, '', url.toString())
      } else {
        pid = localStorage.getItem(`participant_${tournamentId}`)
        if (pid) setParticipantId(pid)
      }
    }

    if (!pid) return

    const participant = participants.find((p) => p.id === pid)
    const name =
      participant?.name ??
      (participant?.profiles as unknown as Profile | null)?.display_name ??
      (participant?.profiles as unknown as Profile | null)?.username ??
      null
    setMyName(name)

    const allMatches = rounds.flatMap((r) => (r.matches ?? []) as unknown as ActiveMatch[])
    const active = allMatches.find((m) => {
      const byUserId = currentUserId && (m.player1_id === currentUserId || m.player2_id === currentUserId)
      const byName = name && (m.player1_name === name || m.player2_name === name)
      return (byUserId || byName) && ['scheduled', 'awaiting_confirmation'].includes(m.status)
    }) ?? null
    setMyMatch(active)
  }, [participantId, participants, rounds, currentUserId, tournamentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSubmitting(true)

    const s1 = parseInt(p1Score, 10)
    const s2 = parseInt(p2Score, 10)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setMessage({ type: 'error', text: 'Enter valid non-negative scores.' })
      setSubmitting(false)
      return
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (!currentUserId && participantId) {
      headers['X-Participant-Id'] = participantId
    }

    const res = await fetch(`/api/matches/${myMatch!.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ player1_score: s1, player2_score: s2, screenshot_url: screenshotPath }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error })
      return
    }

    if (data.status === 'awaiting_confirmation') {
      setMessage({
        type: 'success',
        text: 'Score submitted! The organizer will review and confirm the result.',
      })
      router.refresh()
    } else if (data.status === 'disputed') {
      setMessage({ type: 'warning', text: data.message })
    } else if (data.status === 'completed') {
      setMessage({ type: 'success', text: 'Result confirmed!' })
      router.refresh()
    }
  }

  const format = (tournament as unknown as { format?: string }).format ?? 'knockout'
  const allMatches = rounds.flatMap((r) => r.matches ?? []) as unknown as MatchWithPlayers[]
  const opponentName = myMatch
    ? currentUserId && myMatch.player1_id === currentUserId
      ? (myMatch.player2_name ?? profileMap[myMatch.player2_id ?? '']?.display_name ?? 'Opponent')
      : myName && myMatch.player1_name === myName
      ? (myMatch.player2_name ?? 'Opponent')
      : (myMatch.player1_name ?? 'Opponent')
    : null

  const organizer = tournament.profiles as unknown as Profile | null
  const isOrganizer = !!currentUserId && currentUserId === tournament.organizer_id

  // Determine winner and top scorer for completed tournaments
  const completedMatches = allMatches.filter((m) => (m as unknown as { status: string }).status === 'completed')

  // Split matches into the tables that should be shown separately. Rendering one
  // table over every match merged all groups of a group-stage cup into a single
  // ranking, and mixed CL playoff/knockout results into the league standings.
  type GroupedMatch = { group_name?: string | null; bracket?: string | null; status: string }
  const standingsGroups: { label: string | null; matches: typeof allMatches }[] = (() => {
    const typed = allMatches as unknown as GroupedMatch[]

    if (format === 'group_knockout') {
      const byGroup = new Map<string, typeof allMatches>()
      typed.forEach((m, i) => {
        if (!m.group_name) return
        const bucket = byGroup.get(m.group_name) ?? []
        bucket.push(allMatches[i])
        byGroup.set(m.group_name, bucket)
      })
      if (byGroup.size > 0) {
        return Array.from(byGroup.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, matches]) => ({ label, matches }))
      }
    }

    if (format === 'champions_league') {
      const league = allMatches.filter((_, i) => typed[i].bracket === 'league')
      if (league.length > 0) return [{ label: null, matches: league }]
    }

    return [{ label: null, matches: allMatches }]
  })()

  // This player's own finalized matches — they can contest these (a high-confidence
  // AI screenshot read finalizes without organizer review, so mistakes can slip through)
  type FinalizedMatch = {
    id: string; status: string
    player1_id: string | null; player1_name: string | null
    player2_id: string | null; player2_name: string | null
    player1_score: number | null; player2_score: number | null
    disputed?: boolean | null
  }
  const myFinalizedMatches = (allMatches as unknown as FinalizedMatch[]).filter((m) => {
    const byUserId = currentUserId && (m.player1_id === currentUserId || m.player2_id === currentUserId)
    const byName = myName && (m.player1_name === myName || m.player2_name === myName)
    return (byUserId || byName) && (m.status === 'completed' || m.status === 'walkover')
  })
  const cardProfileMap = new Map(
    Object.entries(profileMap).map(([uid, p]) => [uid, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url }])
  )

  // Winner: player who won the highest-round completed match
  let winnerId: string | null = null
  let winnerName: string | null = null
  if (tournament.status === 'completed' && rounds.length > 0) {
    const sortedRounds = [...rounds].sort((a, b) => b.round_number - a.round_number)
    for (const r of sortedRounds) {
      const finalMatch = (r.matches ?? []).find((m) => (m as unknown as { status: string }).status === 'completed' || (m as unknown as { status: string }).status === 'walkover')
      if (finalMatch) {
        const fm = finalMatch as unknown as { winner_id?: string | null; player1_id: string | null; player1_name: string | null; player2_id: string | null; player2_name: string | null; player1_score: number | null; player2_score: number | null }
        winnerId = fm.winner_id ?? null
        if (!winnerId) {
          const p1s = fm.player1_score ?? 0
          const p2s = fm.player2_score ?? 0
          winnerName = p1s >= p2s ? fm.player1_name : fm.player2_name
        } else {
          winnerName = profileMap[winnerId]?.display_name ?? profileMap[winnerId]?.username ?? null
        }
        break
      }
    }
  }

  const topScorer = tournament.status === 'completed' ? calcTopScorer(completedMatches as unknown as import('@/lib/utils/card-helpers').MatchRow[], cardProfileMap) : null

  const isWinner = tournament.status === 'completed' && (
    isOrganizer ||
    (currentUserId && currentUserId === winnerId) ||
    (myName && myName === winnerName)
  )
  const isTopScorer = tournament.status === 'completed' && (
    isOrganizer ||
    (topScorer && currentUserId && topScorer.id === currentUserId) ||
    (topScorer && myName && topScorer.name === myName)
  )

  return (
    <div className="page-container">
      {/* Guest push prompt — shown only to guest players (no account) */}
      {!currentUserId && <GuestPushPrompt tournamentId={tournamentId} />}
      {/* Save-link banner — shown once after first join */}
      {!currentUserId && <SaveLinkBanner tournamentId={tournamentId} />}
      {/* Identity reclaim — shown when guest has no stored identity */}
      {!currentUserId && !participantId && <ReclaimIdentity tournamentId={tournamentId} onReclaimed={(pid) => setParticipantId(pid)} />}
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="section-title">{tournament.title}</h1>
          <TournamentStatusBadge status={tournament.status} />
        </div>
        {tournament.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{tournament.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4" />
            {tournament.game_name}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {participants.length} / {tournament.max_participants} players
          </span>
          {tournament.starts_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(tournament.starts_at).toLocaleString()}
            </span>
          )}
        </div>
        {organizer && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Organized by{' '}
            <span className="font-medium text-gray-600 dark:text-gray-300">
              {organizer.display_name ?? organizer.username}
            </span>
          </p>
        )}
        {myName && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 px-3 py-1">
            <CheckCircle className="h-3.5 w-3.5 text-brand-500" />
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
              Joined as {myName}
            </span>
          </div>
        )}
      </div>

      {/* ── Winner / Top Scorer cards — shown only to the winner, top scorer, or organizer */}
      {tournament.status === 'completed' && (isWinner || isTopScorer) && (
        <div className="mb-8">
          <CardDownloadButtons
            tournamentId={tournamentId}
            showWinner={!!isWinner}
            showTopScorer={!!isTopScorer}
          />
        </div>
      )}

      {/* ── Your Match card ───────────────────────────────────────────────── */}
      {myMatch && (
        <div className="mb-8 rounded-xl border border-brand-400/40 dark:border-brand-600/40 bg-brand-50 dark:bg-brand-900/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider">
              Your Match
            </h2>
            {myMatch.status === 'awaiting_confirmation' && (
              <span className="ml-auto flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                <Clock className="h-3.5 w-3.5" />
                Awaiting organizer confirmation
              </span>
            )}
          </div>
          {format === 'home_away_knockout' && (myMatch as { tie_id?: string | null }).tie_id && (
            <span className="inline-flex items-center text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">
              {(myMatch as { leg?: number | null }).leg === 1 ? 'Leg 1 of 2' : 'Leg 2 of 2'}
            </span>
          )}
          <p className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Match #{myMatch.match_number} · vs{' '}
            <span className="text-brand-600 dark:text-brand-400">{opponentName}</span>
          </p>

          {/* Predictions bar */}
          <PredictionBar
            matchId={myMatch.id}
            player1Name={myMatch.player1_name ?? profileMap[myMatch.player1_id ?? '']?.display_name ?? profileMap[myMatch.player1_id ?? '']?.username ?? 'Player 1'}
            player2Name={myMatch.player2_name ?? profileMap[myMatch.player2_id ?? '']?.display_name ?? profileMap[myMatch.player2_id ?? '']?.username ?? 'Player 2'}
            matchStatus={myMatch.status}
            matchWinnerId={null}
            player1Id={myMatch.player1_id}
            player2Id={myMatch.player2_id}
            currentUserId={currentUserId}
          />

          {myMatch.status === 'awaiting_confirmation' ? (
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
              Score submitted. The organizer will verify and confirm the result.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Play the match, enter the final score, and upload a screenshot for the organizer to verify.
              </p>

              {/* Score inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 truncate">
                    {myMatch.player1_name ?? profileMap[myMatch.player1_id ?? '']?.display_name ?? 'Player 1'}
                  </p>
                  <Input
                    type="number"
                    min="0"
                    max="99"
                    required
                    value={p1Score}
                    onChange={(e) => setP1Score(e.target.value)}
                    placeholder="0"
                    className="text-center text-2xl font-bold"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 truncate">
                    {myMatch.player2_name ?? profileMap[myMatch.player2_id ?? '']?.display_name ?? 'Player 2'}
                  </p>
                  <Input
                    type="number"
                    min="0"
                    max="99"
                    required
                    value={p2Score}
                    onChange={(e) => setP2Score(e.target.value)}
                    placeholder="0"
                    className="text-center text-2xl font-bold"
                  />
                </div>
              </div>

              {/* Screenshot upload — works for guests and registered users */}
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Match Screenshot{' '}
                  <span className="normal-case font-normal text-gray-400">(optional but recommended)</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  The organizer will see your screenshot and confirm the result — only one player needs to submit.
                </p>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFile}
                  className="hidden"
                  id="portal-screenshot-upload"
                />

                {uploadStatus === 'idle' && (
                  <label
                    htmlFor="portal-screenshot-upload"
                    className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors"
                  >
                    <ImagePlus className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Upload match screenshot
                    </span>
                  </label>
                )}

                {uploadStatus === 'uploading' && (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
                    <Spinner size="sm" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Uploading {uploadFileName}…
                    </span>
                  </div>
                )}

                {uploadStatus === 'scanning' && (
                  <div className="flex items-center gap-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-4 py-3">
                    <Spinner size="sm" />
                    <span className="text-sm text-purple-700 dark:text-purple-400">
                      🤖 AI is scanning the screenshot for the score…
                    </span>
                  </div>
                )}

                {uploadStatus === 'done' && (
                  <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="flex-1 text-sm text-green-700 dark:text-green-400 truncate">
                      {uploadFileName}
                    </span>
                    <button
                      type="button"
                      onClick={clearScreenshot}
                      className="text-green-600 dark:text-green-400 hover:text-red-500 transition-colors"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {uploadStatus === 'error' && (
                  <div className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
                    <span className="flex-1 text-sm text-red-700 dark:text-red-400">
                      Upload failed — try again.
                    </span>
                    <button type="button" onClick={clearScreenshot} className="text-red-600 dark:text-red-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {aiNotice && (
                  <div
                    className={`mt-2 rounded-lg border px-4 py-3 text-sm ${
                      aiNotice.type === 'low'
                        ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                        : 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                    }`}
                  >
                    {aiNotice.text}
                  </div>
                )}
              </div>

              {message && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm border ${
                    message.type === 'error'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                      : message.type === 'warning'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <Button type="submit" loading={submitting} disabled={uploadStatus === 'uploading' || uploadStatus === 'scanning'} size="lg">
                <Upload className="h-4 w-4" />
                Submit Score
              </Button>
            </form>
          )}
        </div>
      )}

      {/* Tournament not started yet */}
      {tournament.status === 'open' && (
        <div className="mb-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            The tournament hasn&apos;t started yet. Check back once the organizer kicks things off.
          </p>
        </div>
      )}

      {/* Bracket / Schedule / Standings */}
      {rounds.length > 0 && (
        <div className="mb-10">
          {format === 'knockout' || format === 'double_elimination' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bracket</h2>
              <BracketView
                rounds={rounds}
                currentUserId={currentUserId ?? undefined}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
              />
            </>
          ) : format === 'home_away_knockout' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bracket</h2>
              <HomeAwayBracketView
                rounds={rounds}
                profileMap={profileMap}
                // participantId is set for logged-in users too (the portal page
                // resolves it), so blanking currentUserId whenever it exists hid
                // the leg links and "your tie" highlight from every registered
                // player — while ScheduleView below still got the real id.
                currentUserId={currentUserId ?? undefined}
                organizerId={tournament.organizer_id}
              />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">Schedule</h2>
              <ScheduleView
                rounds={rounds}
                currentUserId={currentUserId ?? undefined}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
                format={format}
              />
            </>
          ) : (
            <>
              {allMatches.some((m) => m.status === 'completed') && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Standings</h2>
                  {standingsGroups.map((g) => (
                    <div key={g.label ?? 'all'} className="mb-6 last:mb-0">
                      {g.label && (
                        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                          Group {g.label}
                        </h3>
                      )}
                      <StandingsTable
                        matches={g.matches}
                        participants={participants}
                        format={format === 'champions_league' ? 'league' : 'round_robin'}
                        groupName={g.label ?? undefined}
                      />
                    </div>
                  ))}
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule</h2>
              <ScheduleView
                rounds={rounds}
                currentUserId={currentUserId ?? undefined}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
                format={format}
              />
            </>
          )}
        </div>
      )}

      {/* Your results — contest anything that looks wrong */}
      {myFinalizedMatches.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Your Results</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Spot a wrong score? Flag it and the organizer can correct it.
          </p>
          <div className="flex flex-col gap-3">
            {myFinalizedMatches.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 flex flex-col gap-2"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {m.player1_name ?? 'Player 1'} vs {m.player2_name ?? 'Player 2'}
                  {m.player1_score !== null && m.player2_score !== null && (
                    <span className="ml-2 font-bold text-brand-500">
                      {m.player1_score} – {m.player2_score}
                    </span>
                  )}
                </p>
                {m.disputed ? (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    ⚠ Disputed — the organizer has been notified.
                  </p>
                ) : (
                  <DisputeButton matchId={m.id} participantId={currentUserId ? null : participantId} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Scorers */}
      {tournament.status !== 'open' && rounds.length > 0 && (
        <div className="mb-8">
          <TopScorersTable
            matches={rounds.flatMap((r) => (r.matches ?? []) as unknown as Array<{
              id: string; player1_id: string | null; player1_name: string | null
              player2_id: string | null; player2_name: string | null
              player1_score: number | null; player2_score: number | null; status: string
            }>)}
            profileMap={Object.fromEntries(
              Object.entries(profileMap).map(([k, v]) => [k, { display_name: v.display_name, username: v.username, avatar_url: v.avatar_url }])
            )}
          />
        </div>
      )}

      {/* Participants */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Participants ({participants.length})
        </h2>
        <ParticipantList
          participants={participants}
          organizerId={tournament.organizer_id}
          currentUserId={currentUserId ?? undefined}
          tournamentId={tournamentId}
        />
      </div>
    </div>
  )
}

// ── ReclaimIdentity ───────────────────────────────────────────────────────────

function ReclaimIdentity({
  tournamentId,
  onReclaimed,
}: {
  tournamentId: string
  onReclaimed: (pid: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch(
      `/api/tournaments/${tournamentId}/reclaim?name=${encodeURIComponent(name.trim())}`
    )
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Not found')
      return
    }

    localStorage.setItem(`participant_${tournamentId}`, data.participant_id)
    onReclaimed(data.participant_id)
    setOpen(false)
  }

  return (
    <div className="mb-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 hover:border-brand-500/50 px-4 py-3 text-sm text-gray-500 hover:text-brand-400 transition-colors"
        >
          <span>🔍</span> Lost your link? Recover access with your name
        </button>
      ) : (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
          <p className="text-sm font-semibold text-gray-200 mb-1">Recover your access</p>
          <p className="text-xs text-gray-500 mb-4">
            Enter the exact nametag you used when you joined this tournament.
          </p>
          <form onSubmit={handleLookup} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PhilEFC"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl text-sm font-bold text-white transition-colors"
            >
              {loading ? '…' : 'Find me'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError('') }}
              className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </form>
          {error && (
            <p className="mt-2 text-xs text-red-400">{error} — check the spelling of your nametag.</p>
          )}
        </div>
      )}
    </div>
  )
}
