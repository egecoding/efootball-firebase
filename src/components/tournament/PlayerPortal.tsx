'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Users, Calendar, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import { BracketView } from '@/components/tournament/BracketView'
import { ScheduleView } from '@/components/tournament/ScheduleView'
import { StandingsTable } from '@/components/tournament/StandingsTable'
import { ParticipantList } from '@/components/tournament/ParticipantList'
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

  // Resolve identity: prefer server-supplied (logged-in user), fall back to localStorage (guest)
  const [participantId, setParticipantId] = useState<string | null>(userParticipantId)
  const [myName, setMyName] = useState<string | null>(null)
  const [myMatch, setMyMatch] = useState<ActiveMatch | null>(null)

  // Score form state
  const [p1Score, setP1Score] = useState('')
  const [p2Score, setP2Score] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

  useEffect(() => {
    // Read localStorage for guest participant_id if not already set
    let pid = participantId
    if (!pid) {
      pid = localStorage.getItem(`participant_${tournamentId}`)
      if (pid) setParticipantId(pid)
    }

    if (!pid) return

    // Find participant's name from the list
    const participant = participants.find((p) => p.id === pid)
    const name =
      participant?.name ??
      (participant?.profiles as unknown as Profile | null)?.display_name ??
      (participant?.profiles as unknown as Profile | null)?.username ??
      null
    setMyName(name)

    // Find their active match across all rounds
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
    // For guests, pass participant_id as credential
    if (!currentUserId && participantId) {
      headers['X-Participant-Id'] = participantId
    }

    const res = await fetch(`/api/matches/${myMatch!.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ player1_score: s1, player2_score: s2, screenshot_url: null }),
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

  return (
    <div className="page-container">
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

      {/* ── Your Match card ────────────────────────────────────────────────── */}
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
          <p className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Match #{myMatch.match_number} · vs{' '}
            <span className="text-brand-600 dark:text-brand-400">{opponentName}</span>
          </p>

          {myMatch.status === 'awaiting_confirmation' ? (
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
              Score submitted. The organizer will verify and confirm the result.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Play the match, then enter the final score below. The organizer will confirm.
              </p>
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

              {/* Screenshot upload link — registered users only */}
              {currentUserId && (
                <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-4 py-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                  <span>
                    Want to attach a screenshot?{' '}
                    <Link
                      href={`/matches/${myMatch.id}`}
                      className="text-brand-500 hover:underline font-medium"
                    >
                      Open full result form
                    </Link>
                  </span>
                </div>
              )}

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

              <Button type="submit" loading={submitting} size="lg">
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
          {format === 'knockout' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bracket</h2>
              <BracketView
                rounds={rounds}
                currentUserId={currentUserId ?? undefined}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
              />
            </>
          ) : (
            <>
              {allMatches.some((m) => m.status === 'completed') && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Standings</h2>
                  <StandingsTable
                    matches={allMatches}
                    participants={participants}
                    format={format as 'round_robin' | 'league'}
                  />
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule</h2>
              <ScheduleView
                rounds={rounds}
                currentUserId={currentUserId ?? undefined}
                organizerId={tournament.organizer_id}
                profileMap={profileMap}
              />
            </>
          )}
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
