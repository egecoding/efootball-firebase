'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Play, Trash2, UserPlus, ExternalLink, CheckCircle, ClipboardEdit, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { InviteModal } from './InviteModal'
import { ParticipantList } from './ParticipantList'
import { TournamentStatusBadge, MatchStatusBadge } from '@/components/ui/Badge'
import type { TournamentWithOrganizer, ParticipantWithProfile } from '@/types/database'
import type { ManageMatch } from '@/app/tournaments/[id]/manage/page'

interface ManagePanelProps {
  tournament: TournamentWithOrganizer
  participants: ParticipantWithProfile[]
  matches: ManageMatch[]
  baseUrl: string
  isSuperAdmin?: boolean
  currentUserId?: string
}

export function ManagePanel({ tournament, participants, matches, baseUrl, isSuperAdmin = false, currentUserId }: ManagePanelProps) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [startLoading, setStartLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState('')

  const [playerInput, setPlayerInput] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Per-match confirm state (awaiting_confirmation)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmErrors, setConfirmErrors] = useState<Record<string, string>>({})

  const [advancingKnockout, setAdvancingKnockout] = useState(false)
  const [generatingNextRound, setGeneratingNextRound] = useState(false)
  const [advancingCLPlayoffs, setAdvancingCLPlayoffs] = useState(false)

  // Per-match manual entry state (scheduled matches)
  const [enteringId, setEnteringId] = useState<string | null>(null)
  const [manualScores, setManualScores] = useState<Record<string, { p1: string; p2: string }>>({})
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({})
  const [submittingManualId, setSubmittingManualId] = useState<string | null>(null)

  const isFull = participants.length >= tournament.max_participants

  async function addPlayer() {
    const name = playerInput.trim()
    if (!name) return
    setAddError('')
    setAdding(true)
    const res = await fetch(`/api/tournaments/${tournament.id}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setAdding(false)
    if (!res.ok) {
      const { error: msg } = await res.json()
      setAddError(msg)
      return
    }
    setPlayerInput('')
    inputRef.current?.focus()
    router.refresh()
  }

  async function startTournament() {
    setError('')
    setStartLoading(true)
    const res = await fetch(`/api/tournaments/${tournament.id}/start`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setStartLoading(false)
      return
    }
    router.push(`/tournaments/${tournament.id}`)
    router.refresh()
  }

  async function generateNextSwissRound() {
    setError('')
    setGeneratingNextRound(true)
    const res = await fetch(`/api/tournaments/${tournament.id}/next-swiss-round`, { method: 'POST' })
    const data = await res.json()
    setGeneratingNextRound(false)
    if (!res.ok) { setError(data.error); return }
    router.refresh()
  }

  async function advanceCLPlayoffs() {
    setError('')
    setAdvancingCLPlayoffs(true)
    const res = await fetch(`/api/tournaments/${tournament.id}/advance-cl-playoffs`, { method: 'POST' })
    const data = await res.json()
    setAdvancingCLPlayoffs(false)
    if (!res.ok) { setError(data.error); return }
    router.refresh()
  }

  async function advanceToKnockout() {
    setError('')
    setAdvancingKnockout(true)
    const res = await fetch(`/api/tournaments/${tournament.id}/advance-knockout`, { method: 'POST' })
    const data = await res.json()
    setAdvancingKnockout(false)
    if (!res.ok) {
      setError(data.error)
      return
    }
    router.refresh()
  }

  async function deleteTournament() {
    if (!confirm('Delete this tournament? This cannot be undone.')) return
    setDeleteLoading(true)
    await fetch(`/api/tournaments/${tournament.id}`, { method: 'DELETE' })
    router.push('/dashboard')
    router.refresh()
  }

  async function confirmResult(matchId: string) {
    setConfirmingId(matchId)
    setConfirmErrors((prev) => ({ ...prev, [matchId]: '' }))
    const res = await fetch(`/api/matches/${matchId}/confirm`, { method: 'POST' })
    const data = await res.json()
    setConfirmingId(null)
    if (!res.ok) {
      setConfirmErrors((prev) => ({ ...prev, [matchId]: data.error }))
      return
    }
    router.refresh()
  }

  async function enterResult(matchId: string) {
    const scores = manualScores[matchId]
    const p1 = parseInt(scores?.p1 ?? '', 10)
    const p2 = parseInt(scores?.p2 ?? '', 10)
    if (isNaN(p1) || isNaN(p2) || p1 < 0 || p2 < 0) {
      setManualErrors((prev) => ({ ...prev, [matchId]: 'Enter valid non-negative scores.' }))
      return
    }
    setManualErrors((prev) => ({ ...prev, [matchId]: '' }))
    setSubmittingManualId(matchId)
    const res = await fetch(`/api/matches/${matchId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player1_score: p1, player2_score: p2 }),
    })
    const data = await res.json()
    setSubmittingManualId(null)
    if (!res.ok) {
      setManualErrors((prev) => ({ ...prev, [matchId]: data.error }))
      return
    }
    setEnteringId(null)
    router.refresh()
  }

  // group_knockout: show "Advance to Knockout" when all group matches done and no knockout matches yet
  const groupMatches = matches.filter((m) => m.group_name != null)
  const hasKnockoutMatches = matches.some((m) => m.group_name == null && m.round_phase === 'knockout')
  const groupPhaseComplete =
    tournament.format === 'group_knockout' &&
    groupMatches.length > 0 &&
    groupMatches.every((m) => m.status === 'completed' || m.status === 'walkover') &&
    !hasKnockoutMatches

  // champions_league: compute standings + phase state
  const clLeagueMatches = matches.filter((m) => m.bracket === 'league')
  const clPlayoffMatches = matches.filter((m) => m.bracket === 'playoff')
  const clHasPlayoffs = clPlayoffMatches.length > 0
  const clLeagueRoundsPlayed = clLeagueMatches.length > 0
    ? Math.max(...clLeagueMatches.map((m) => m.round_number ?? 0))
    : 0
  const clAllLeagueDone = clLeagueMatches.length > 0 &&
    clLeagueMatches.every((m) => m.status === 'completed' || m.status === 'walkover')
  const clTotalRoundsCount = (() => {
    const n = participants.length
    if (n <= 6) return 3
    if (n <= 12) return 4
    if (n <= 20) return 6
    return 7
  })()
  const clCanGenerateNextRound =
    tournament.format === 'champions_league' &&
    clAllLeagueDone &&
    clLeagueRoundsPlayed < clTotalRoundsCount &&
    !clHasPlayoffs
  const clCanAdvancePlayoffs =
    tournament.format === 'champions_league' &&
    clAllLeagueDone &&
    clLeagueRoundsPlayed >= clTotalRoundsCount &&
    !clHasPlayoffs

  // CL standings (from league matches)
  interface CLStandingRow { name: string; pts: number; played: number; gf: number; ga: number; gd: number; wins: number; draws: number }
  const clStandings = (() => {
    if (tournament.format !== 'champions_league') return []
    const map = new Map<string, CLStandingRow>()
    const getKey = (id: string | null, name: string | null) => id ?? name ?? '?'
    const get = (id: string | null, name: string | null): CLStandingRow => {
      const k = getKey(id, name)
      if (!map.has(k)) map.set(k, { name: name ?? id ?? '?', pts: 0, played: 0, gf: 0, ga: 0, gd: 0, wins: 0, draws: 0 })
      return map.get(k)!
    }
    for (const m of clLeagueMatches) {
      if (m.status !== 'completed' && m.status !== 'walkover') continue
      const s1 = m.player1_score ?? 0
      const s2 = m.player2_score ?? 0
      const p1 = get(m.player1_id, m.player1_name)
      const p2 = get(m.player2_id, m.player2_name)
      p1.played++; p2.played++
      p1.gf += s1; p1.ga += s2; p1.gd = p1.gf - p1.ga
      p2.gf += s2; p2.ga += s1; p2.gd = p2.gf - p2.ga
      if (s1 > s2) { p1.pts += 3; p1.wins++ }
      else if (s2 > s1) { p2.pts += 3; p2.wins++ }
      else { p1.pts += 1; p2.pts += 1; p1.draws++; p2.draws++ }
    }
    return Array.from(map.values()).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  })()

  // group_knockout: per-group standings tables
  interface GroupStandingRow { name: string; pts: number; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number }
  const groupStandingsByGroup = (() => {
    if (tournament.format !== 'group_knockout' || groupMatches.length === 0) return new Map<string, GroupStandingRow[]>()
    const result = new Map<string, Map<string, GroupStandingRow>>()
    const getKey = (id: string | null, name: string | null) => id ?? name ?? '?'
    const getRow = (groupName: string, id: string | null, name: string | null): GroupStandingRow => {
      if (!result.has(groupName)) result.set(groupName, new Map())
      const groupMap = result.get(groupName)!
      const k = getKey(id, name)
      if (!groupMap.has(k)) groupMap.set(k, { name: name ?? id ?? '?', pts: 0, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0 })
      return groupMap.get(k)!
    }
    for (const m of groupMatches) {
      if (!m.group_name) continue
      const s1 = m.player1_score ?? 0
      const s2 = m.player2_score ?? 0
      const p1 = getRow(m.group_name, m.player1_id, m.player1_name)
      const p2 = getRow(m.group_name, m.player2_id, m.player2_name)
      if (m.status !== 'completed' && m.status !== 'walkover') continue
      p1.played++; p2.played++
      p1.gf += s1; p1.ga += s2; p1.gd = p1.gf - p1.ga
      p2.gf += s2; p2.ga += s1; p2.gd = p2.gf - p2.ga
      if (s1 > s2) { p1.pts += 3; p1.wins++; p2.losses++ }
      else if (s2 > s1) { p2.pts += 3; p2.wins++; p1.losses++ }
      else { p1.pts += 1; p2.pts += 1; p1.draws++; p2.draws++ }
    }
    const sorted = new Map<string, GroupStandingRow[]>()
    for (const [gName, gMap] of Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      sorted.set(gName, Array.from(gMap.values()).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.wins - a.wins))
    }
    return sorted
  })()

  const activeMatches = matches.filter((m) => {
    if (m.status === 'completed') return true
    if (m.status === 'awaiting_confirmation') return true
    // scheduled: show only if at least both player slots are filled (by id or name)
    const p1 = m.player1_id ?? m.player1_name
    const p2 = m.player2_id ?? m.player2_name
    return p1 !== null && p2 !== null
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Status */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Status</h2>
          <TournamentStatusBadge status={tournament.status} />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {participants.length} / {tournament.max_participants} participants
        </p>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Actions</h2>

        <Button
          variant="secondary"
          onClick={() => setInviteOpen(true)}
          className="justify-start gap-3"
        >
          <Share2 className="h-4 w-4" />
          Share Invite Link
        </Button>

        {tournament.status === 'open' && (
          <Button
            onClick={startTournament}
            loading={startLoading}
            disabled={participants.length < 2}
            className="justify-start gap-3"
          >
            <Play className="h-4 w-4" />
            Start Tournament
            {participants.length < 2 && (
              <span className="text-xs opacity-70 ml-auto">(need ≥2 players)</span>
            )}
          </Button>
        )}

        {groupPhaseComplete && (
          <Button
            onClick={advanceToKnockout}
            loading={advancingKnockout}
            className="justify-start gap-3"
          >
            <Trophy className="h-4 w-4" />
            Advance to Knockout Stage
          </Button>
        )}

        {clCanGenerateNextRound && (
          <Button
            onClick={generateNextSwissRound}
            loading={generatingNextRound}
            className="justify-start gap-3"
          >
            <Play className="h-4 w-4" />
            Generate League Round {clLeagueRoundsPlayed + 1}
            <span className="text-xs opacity-70 ml-auto">({clLeagueRoundsPlayed}/{clTotalRoundsCount} done)</span>
          </Button>
        )}

        {clCanAdvancePlayoffs && (
          <Button
            onClick={advanceCLPlayoffs}
            loading={advancingCLPlayoffs}
            className="justify-start gap-3"
          >
            <Trophy className="h-4 w-4" />
            Advance to Playoffs &amp; Knockout
          </Button>
        )}

        <Button
          variant="danger"
          onClick={deleteTournament}
          loading={deleteLoading}
          className="justify-start gap-3"
        >
          <Trash2 className="h-4 w-4" />
          Delete Tournament
        </Button>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Add Player (open tournaments only) */}
      {tournament.status === 'open' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Add Player</h2>
            {isFull && (
              <span className="ml-auto text-xs text-gray-400">Tournament is full</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={playerInput}
              onChange={(e) => { setAddError(''); setPlayerInput(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }}
              placeholder="Player name or tag…"
              disabled={isFull || adding}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addPlayer}
              loading={adding}
              disabled={isFull}
            >
              Add
            </Button>
          </div>
          {addError && (
            <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>
          )}
        </div>
      )}

      {/* Match Results (in-progress / completed tournaments) */}
      {tournament.status !== 'open' && activeMatches.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Match Results</h2>
            <button
              onClick={() => router.refresh()}
              title="Refresh match data"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {activeMatches.map((m) => {
              const p1 = m.player1_name ?? 'TBD'
              const p2 = m.player2_name ?? 'TBD'
              const scoreText =
                m.player1_score !== null && m.player2_score !== null
                  ? `${m.player1_score} – ${m.player2_score}`
                  : null
              const isConfirming = confirmingId === m.id
              const confirmError = confirmErrors[m.id]
              const isEntering = enteringId === m.id
              const isSubmittingManual = submittingManualId === m.id
              const manualError = manualErrors[m.id]
              const hasPlayers = (m.player1_id ?? m.player1_name) !== null && (m.player2_id ?? m.player2_name) !== null

              return (
                <div
                  key={m.id}
                  className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {(m.round_name || m.group_name || m.bracket || m.leg) && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                          {m.group_name ? `Group ${m.group_name} · ` : ''}
                          {m.bracket === 'winners' ? 'Winners · ' :
                           m.bracket === 'losers' ? 'Losers · ' :
                           m.bracket === 'grand_final' ? '🏆 Grand Final · ' :
                           m.bracket === 'league' ? '📋 League · ' :
                           m.bracket === 'playoff' ? '⚡ Playoff · ' : ''}
                          {m.round_name ?? ''}
                          {m.leg === 1 ? ' · 1st Leg' : m.leg === 2 ? ' · 2nd Leg' : ''}
                        </p>
                      )}
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {p1} vs {p2}
                        {scoreText && (
                          <span className="ml-2 font-bold text-brand-500">{scoreText}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <MatchStatusBadge status={m.status as 'pending' | 'scheduled' | 'awaiting_confirmation' | 'completed' | 'walkover'} />
                      <Link
                        href={`/matches/${m.id}`}
                        className="text-gray-400 hover:text-brand-500 transition-colors"
                        title="View match"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Finalized screenshot */}
                  {m.screenshotSignedUrl && (
                    <a href={m.screenshotSignedUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={m.screenshotSignedUrl}
                        alt="Match screenshot"
                        className="w-full rounded border border-gray-200 dark:border-gray-700 object-contain max-h-40"
                      />
                    </a>
                  )}

                  {/* Submission screenshot — player submitted, organizer confirms inline */}
                  {m.submissionScreenshotSignedUrl && (
                    <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3">
                      <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                        Screenshot submitted{m.submittedByName ? ` by ${m.submittedByName}` : ''} — pending your confirmation
                      </p>
                      <a href={m.submissionScreenshotSignedUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={m.submissionScreenshotSignedUrl}
                          alt="Submitted screenshot"
                          className="w-full rounded border border-yellow-200 dark:border-yellow-700 object-contain max-h-48 mb-3"
                        />
                      </a>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {scoreText && (
                          <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
                            Submitted score: {scoreText}
                          </p>
                        )}
                        {m.ai_score_confidence === 'high' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                            ✓ AI verified
                          </span>
                        )}
                        {m.ai_score_confidence === 'low' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                            ⚠ AI couldn&apos;t read clearly
                          </span>
                        )}
                      </div>
                      {confirmError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mb-2">{confirmError}</p>
                      )}
                      <button
                        onClick={() => confirmResult(m.id)}
                        disabled={isConfirming}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {isConfirming ? 'Confirming…' : 'Confirm Result'}
                      </button>
                    </div>
                  )}

                  {/* awaiting_confirmation with scores but no screenshot — show plain confirm */}
                  {m.status === 'awaiting_confirmation' && !m.submissionScreenshotSignedUrl &&
                    m.player1_score !== null && m.player2_score !== null && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Scores submitted — no screenshot provided.
                      </p>
                      {confirmErrors[m.id] && (
                        <p className="text-xs text-red-600 dark:text-red-400">{confirmErrors[m.id]}</p>
                      )}
                      <button
                        onClick={() => confirmResult(m.id)}
                        disabled={confirmingId === m.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white transition-colors w-fit"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {confirmingId === m.id ? 'Confirming…' : 'Confirm Result'}
                      </button>
                    </div>
                  )}

                  {/* Manual result entry — for scheduled matches where no score was submitted */}
                  {m.status === 'scheduled' && hasPlayers && (
                    <div>
                      {!isEntering ? (
                        <button
                          onClick={() => {
                            setEnteringId(m.id)
                            setManualScores((prev) => ({ ...prev, [m.id]: prev[m.id] ?? { p1: '', p2: '' } }))
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 transition-colors"
                        >
                          <ClipboardEdit className="h-3.5 w-3.5" />
                          Enter result manually
                        </button>
                      ) : (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 flex flex-col gap-3">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Enter Result</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{p1}</p>
                              <Input
                                type="number"
                                min="0"
                                max="99"
                                placeholder="0"
                                value={manualScores[m.id]?.p1 ?? ''}
                                onChange={(e) => setManualScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], p1: e.target.value } }))}
                                className="text-center font-bold"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{p2}</p>
                              <Input
                                type="number"
                                min="0"
                                max="99"
                                placeholder="0"
                                value={manualScores[m.id]?.p2 ?? ''}
                                onChange={(e) => setManualScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], p2: e.target.value } }))}
                                className="text-center font-bold"
                              />
                            </div>
                          </div>
                          {manualError && (
                            <p className="text-xs text-red-600 dark:text-red-400">{manualError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => enterResult(m.id)}
                              disabled={isSubmittingManual}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              {isSubmittingManual ? 'Saving…' : 'Confirm & Save'}
                            </button>
                            <button
                              onClick={() => setEnteringId(null)}
                              disabled={isSubmittingManual}
                              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Group Stage Standings — one table per group */}
      {tournament.format === 'group_knockout' && groupStandingsByGroup.size > 0 && (
        <div className="flex flex-col gap-4">
          {Array.from(groupStandingsByGroup.entries()).map(([groupName, rows]) => {
            const advancePerGroup = rows.length <= 2 ? 1 : 2
            return (
              <div key={groupName} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Group {groupName}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left py-1.5 pr-2 font-medium w-6">#</th>
                        <th className="text-left py-1.5 pr-2 font-medium">Player</th>
                        <th className="text-center py-1.5 px-1 font-medium">P</th>
                        <th className="text-center py-1.5 px-1 font-medium">W</th>
                        <th className="text-center py-1.5 px-1 font-medium">D</th>
                        <th className="text-center py-1.5 px-1 font-medium">L</th>
                        <th className="text-center py-1.5 px-1 font-medium">GD</th>
                        <th className="text-center py-1.5 px-1 font-semibold text-brand-500">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s, i) => (
                        <tr key={s.name} className={`border-b border-gray-50 dark:border-gray-800/60 ${
                          i < advancePerGroup ? 'bg-green-50/50 dark:bg-green-900/10' : ''
                        }`}>
                          <td className="py-1.5 pr-2 text-gray-400">{i + 1}</td>
                          <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                            {s.name}
                            {i < advancePerGroup && (
                              <span className="ml-1 text-[10px] text-green-600 dark:text-green-400 font-semibold">↑</span>
                            )}
                          </td>
                          <td className="text-center py-1.5 px-1 text-gray-500">{s.played}</td>
                          <td className="text-center py-1.5 px-1 text-gray-500">{s.wins}</td>
                          <td className="text-center py-1.5 px-1 text-gray-500">{s.draws}</td>
                          <td className="text-center py-1.5 px-1 text-gray-500">{s.losses}</td>
                          <td className="text-center py-1.5 px-1 text-gray-500">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                          <td className="text-center py-1.5 px-1 font-bold text-brand-600 dark:text-brand-400">{s.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[10px] text-gray-400">
                    <span className="inline-block w-2 h-2 rounded-sm bg-green-200 dark:bg-green-900/40 mr-1" />
                    Top {advancePerGroup} advance to knockout stage
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Champions League Standings */}
      {tournament.format === 'champions_league' && clStandings.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">League Standings</h2>
            <span className="text-xs text-gray-400">Round {clLeagueRoundsPlayed}/{clTotalRoundsCount}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-1.5 pr-2 font-medium w-6">#</th>
                  <th className="text-left py-1.5 pr-2 font-medium">Player</th>
                  <th className="text-center py-1.5 px-1 font-medium">P</th>
                  <th className="text-center py-1.5 px-1 font-medium">W</th>
                  <th className="text-center py-1.5 px-1 font-medium">D</th>
                  <th className="text-center py-1.5 px-1 font-medium">GD</th>
                  <th className="text-center py-1.5 px-1 font-semibold text-brand-500">Pts</th>
                </tr>
              </thead>
              <tbody>
                {clStandings.map((s, i) => {
                  const { autoQualify, playoffTeams } = (() => {
                    const n = participants.length
                    if (n <= 8) return { autoQualify: 2, playoffTeams: 4 }
                    if (n <= 24) return { autoQualify: 4, playoffTeams: 8 }
                    return { autoQualify: 8, playoffTeams: 16 }
                  })()
                  const isAuto = i < autoQualify
                  const isPlayoff = i >= autoQualify && i < autoQualify + playoffTeams
                  return (
                    <tr key={s.name} className={`border-b border-gray-50 dark:border-gray-800/60 ${
                      isAuto ? 'bg-green-50/50 dark:bg-green-900/10' :
                      isPlayoff ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                    }`}>
                      <td className="py-1.5 pr-2 text-gray-400">{i + 1}</td>
                      <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                        {s.name}
                        {isAuto && <span className="ml-1 text-[10px] text-green-600 dark:text-green-400 font-semibold">Auto</span>}
                        {isPlayoff && <span className="ml-1 text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold">PO</span>}
                      </td>
                      <td className="text-center py-1.5 px-1 text-gray-500">{s.played}</td>
                      <td className="text-center py-1.5 px-1 text-gray-500">{s.wins}</td>
                      <td className="text-center py-1.5 px-1 text-gray-500">{s.draws}</td>
                      <td className="text-center py-1.5 px-1 text-gray-500">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                      <td className="text-center py-1.5 px-1 font-bold text-brand-600 dark:text-brand-400">{s.pts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-400">
              <span><span className="inline-block w-2 h-2 rounded-sm bg-green-200 dark:bg-green-900/40 mr-1" />Auto-qualify</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-yellow-200 dark:bg-yellow-900/40 mr-1" />Playoff</span>
              <span>Remainder eliminated</span>
            </div>
          </div>
        </div>
      )}

      {/* Participants */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
          Participants ({participants.length})
        </h2>
        <ParticipantList
          participants={participants}
          organizerId={tournament.organizer_id}
          currentUserId={currentUserId ?? tournament.organizer_id}
          tournamentId={tournament.id}
        />
      </div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        inviteCode={tournament.invite_code}
        tournamentId={tournament.id}
        tournamentTitle={tournament.title}
        baseUrl={baseUrl}
      />
    </div>
  )
}
