'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Trophy, Users, Calendar, Upload, CheckCircle, Clock, ImagePlus, X, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
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

  // Screenshot state
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadFileName, setUploadFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let pid = participantId
    if (!pid) {
      pid = localStorage.getItem(`participant_${tournamentId}`)
      if (pid) setParticipantId(pid)
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

  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !myMatch) return

    setUploadStatus('uploading')
    setUploadFileName(file.name)
    setScreenshotPath(null)

    const form = new FormData()
    form.append('file', file)

    const headers: Record<string, string> = {}
    if (!currentUserId && participantId) {
      headers['X-Participant-Id'] = participantId
    }

    const res = await fetch(`/api/matches/${myMatch.id}/screenshot`, {
      method: 'POST',
      headers,
      body: form,
    })

    if (!res.ok) {
      setUploadStatus('error')
      setScreenshotPath(null)
      return
    }

    const { path } = await res.json()
    setUploadStatus('done')
    setScreenshotPath(path)
  }

  function clearScreenshot() {
    setUploadStatus('idle')
    setUploadFileName('')
    setScreenshotPath(null)
    if (fileRef.current) fileRef.current.value = ''
  }

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
                  onChange={handleScreenshotUpload}
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

              <Button type="submit" loading={submitting} disabled={uploadStatus === 'uploading'} size="lg">
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
