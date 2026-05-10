import Link from 'next/link'
import type { RoundWithMatches, MatchWithPlayers } from '@/types/database'

/** Vertical slot per tie in the first (widest) column. All geometry keys off this. */
const TIE_SLOT = 124   // px
const CARD_W   = 236   // px
const CONN_W   = 52    // px — SVG connector strip between columns

interface HomeAwayBracketViewProps {
  rounds: RoundWithMatches[]
  profileMap: Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }>
  currentUserId?: string
  organizerId?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TieMatch = MatchWithPlayers & Record<string, any>

interface Stage {
  name: string
  leg1Matches: TieMatch[]
  leg2Matches: TieMatch[] | null
}

export function HomeAwayBracketView({ rounds, profileMap, currentUserId, organizerId }: HomeAwayBracketViewProps) {
  const sorted = [...rounds].sort((a, b) => a.round_number - b.round_number)

  // Group consecutive 1st-Leg / 2nd-Leg rounds into stages
  const stages: Stage[] = []
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    if (r.round_name.includes('1st Leg')) {
      const next = sorted[i + 1]
      const baseName = r.round_name.replace(' — 1st Leg', '')
      stages.push({
        name: baseName,
        leg1Matches: [...(r.matches as TieMatch[])].sort((a, b) => a.match_number - b.match_number),
        leg2Matches: next ? [...(next.matches as TieMatch[])].sort((a, b) => a.match_number - b.match_number) : null,
      })
      i++
    } else {
      stages.push({
        name: r.round_name,
        leg1Matches: [...(r.matches as TieMatch[])].sort((a, b) => a.match_number - b.match_number),
        leg2Matches: null,
      })
    }
  }

  if (stages.length === 0) return null

  const totalStages   = stages.length
  const firstStageTies = stages[0].leg1Matches.length
  const bracketH      = TIE_SLOT * firstStageTies

  function resolveName(id: string | null, fallback: string | null): string {
    if (id && profileMap[id]) {
      return profileMap[id].display_name ?? profileMap[id].username ?? fallback ?? 'TBD'
    }
    return fallback ?? 'TBD'
  }

  return (
    <div className="overflow-x-auto pb-4 -mx-1 px-1">
      {/* ── Round labels row ── */}
      <div className="flex mb-2" style={{ minWidth: 'max-content' }}>
        {stages.map((stage, idx) => (
          <div key={stage.name} className="flex items-center">
            <div
              style={{ width: CARD_W }}
              className={`text-center text-xs font-bold uppercase tracking-widest py-1 ${
                idx === totalStages - 1
                  ? 'text-yellow-500 dark:text-yellow-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {idx === totalStages - 1 ? '🏆 ' : ''}{stage.name}
            </div>
            {idx < totalStages - 1 && <div style={{ width: CONN_W }} />}
          </div>
        ))}
      </div>

      {/* ── Bracket body ── */}
      <div className="flex" style={{ height: bracketH, minWidth: 'max-content', alignItems: 'flex-start' }}>
        {stages.map((stage, stageIdx) => {
          const ties    = stage.leg1Matches
          const slotH   = TIE_SLOT * Math.pow(2, stageIdx)
          const isFinal = stageIdx === totalStages - 1
          const hasLegs = !!stage.leg2Matches

          return (
            <div key={stage.name} className="flex items-start shrink-0">
              {/* ── Stage column ── */}
              <div style={{ width: CARD_W, height: bracketH }} className="flex flex-col">
                {ties.map((leg1) => {
                  // Find the partner leg2 match by shared tie_id
                  const leg2 = stage.leg2Matches?.find(
                    (m) => m.tie_id && leg1.tie_id && m.tie_id === leg1.tie_id
                  ) ?? stage.leg2Matches?.[ties.indexOf(leg1)] ?? null

                  const nameA = resolveName(leg1.player1_id, leg1.player1_name ?? null)
                  const nameB = resolveName(leg1.player2_id, leg1.player2_name ?? null)

                  // In leg2, players are swapped (player B plays at home)
                  const l1A = leg1.player1_score    // Player A goals in Leg 1
                  const l1B = leg1.player2_score    // Player B goals in Leg 1
                  const l2A = leg2?.player2_score ?? null  // Player A goals in Leg 2 (as away)
                  const l2B = leg2?.player1_score ?? null  // Player B goals in Leg 2 (as home)

                  const aggA = l1A !== null && l2A !== null ? l1A + l2A : null
                  const aggB = l1B !== null && l2B !== null ? l1B + l2B : null

                  const leg1Done = leg1.status === 'completed' || leg1.status === 'walkover'
                  const leg2Done = leg2?.status === 'completed' || leg2?.status === 'walkover'
                  const bothDone = leg1Done && leg2Done

                  const winnerA = bothDone && aggA !== null && aggB !== null && aggA > aggB
                  const winnerB = bothDone && aggA !== null && aggB !== null && aggB > aggA

                  const isMyTie   = !!currentUserId && (leg1.player1_id === currentUserId || leg1.player2_id === currentUserId)
                  const isOrg     = !!currentUserId && currentUserId === organizerId
                  const canAct    = isMyTie || isOrg

                  return (
                    <div
                      key={leg1.id}
                      style={{ height: slotH, minHeight: slotH }}
                      className="flex items-center"
                    >
                      <TieCard
                        nameA={nameA}
                        nameB={nameB}
                        l1A={l1A}
                        l1B={l1B}
                        l2A={l2A}
                        l2B={l2B}
                        aggA={aggA}
                        aggB={aggB}
                        winnerA={winnerA}
                        winnerB={winnerB}
                        hasLegs={hasLegs}
                        isFinal={isFinal}
                        isMyTie={isMyTie}
                        canAct={canAct}
                        leg1Id={leg1.id}
                        leg2Id={leg2?.id ?? null}
                        leg1Status={leg1.status}
                        leg2Status={leg2?.status ?? null}
                      />
                    </div>
                  )
                })}
              </div>

              {/* ── SVG connectors ── */}
              {!isFinal && (
                <svg
                  width={CONN_W}
                  height={bracketH}
                  className="shrink-0"
                  style={{ overflow: 'visible' }}
                >
                  {Array.from({ length: Math.floor(ties.length / 2) }, (_, j) => {
                    const y1   = (2 * j) * slotH + slotH / 2
                    const y2   = (2 * j + 1) * slotH + slotH / 2
                    const yMid = (2 * j + 1) * slotH
                    const mx   = CONN_W / 2
                    return (
                      <g key={j} stroke="currentColor" strokeWidth={1.5} fill="none" className="text-gray-300 dark:text-gray-600">
                        <polyline points={`0,${y1} ${mx},${y1} ${mx},${yMid} ${CONN_W},${yMid}`} />
                        <polyline points={`0,${y2} ${mx},${y2} ${mx},${yMid}`} />
                      </g>
                    )
                  })}
                  {/* Bye pass-through for odd tie count */}
                  {ties.length % 2 === 1 && (() => {
                    const y = (ties.length - 1) * slotH + slotH / 2
                    return (
                      <line
                        key="bye"
                        x1={0} y1={y} x2={CONN_W} y2={y}
                        stroke="currentColor" strokeWidth={1.5}
                        className="text-gray-300 dark:text-gray-600"
                      />
                    )
                  })()}
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tie Card ────────────────────────────────────────────────────────────────

function TieCard({
  nameA, nameB,
  l1A, l1B, l2A, l2B,
  aggA, aggB,
  winnerA, winnerB,
  hasLegs, isFinal, isMyTie, canAct,
  leg1Id, leg2Id,
  leg1Status, leg2Status,
}: {
  nameA: string
  nameB: string
  l1A: number | null
  l1B: number | null
  l2A: number | null
  l2B: number | null
  aggA: number | null
  aggB: number | null
  winnerA: boolean
  winnerB: boolean
  hasLegs: boolean
  isFinal: boolean
  isMyTie: boolean
  canAct: boolean
  leg1Id: string
  leg2Id: string | null
  leg1Status: string
  leg2Status: string | null
}) {
  const borderClass = isFinal
    ? 'border-yellow-400/70 dark:border-yellow-500/50 shadow shadow-yellow-500/10'
    : isMyTie
    ? 'border-brand-400 dark:border-brand-500 shadow-sm shadow-brand-500/20'
    : 'border-gray-200 dark:border-gray-700/80'

  const card = (
    <div className={`w-full rounded-lg border bg-white dark:bg-gray-900 overflow-hidden ${borderClass}`}>
      {/* L1 / L2 column header badges */}
      {hasLegs && (
        <div className="flex justify-end items-center gap-0.5 px-2 pt-1.5 pb-0">
          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
            L1
          </span>
          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
            L2
          </span>
        </div>
      )}

      {/* Player A row */}
      <PlayerRow
        name={nameA}
        l1Score={l1A}
        l2Score={l2A}
        isWinner={winnerA}
        isLoser={winnerB}
        hasLegs={hasLegs}
        isFinal={isFinal}
      />

      <div className="h-px bg-gray-100 dark:bg-gray-800" />

      {/* Player B row */}
      <PlayerRow
        name={nameB}
        l1Score={l1B}
        l2Score={l2B}
        isWinner={winnerB}
        isLoser={winnerA}
        hasLegs={hasLegs}
        isFinal={isFinal}
      />

      {/* Aggregate line */}
      {hasLegs && aggA !== null && aggB !== null && (
        <div className="px-2.5 py-1 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/40">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Aggregate:{' '}
            <span className={winnerA ? 'font-semibold text-gray-600 dark:text-gray-300' : ''}>{aggA}</span>
            {' - '}
            <span className={winnerB ? 'font-semibold text-gray-600 dark:text-gray-300' : ''}>{aggB}</span>
          </span>
        </div>
      )}

      {/* Action links — only for players/organizer */}
      {canAct && (
        <div className="flex items-center gap-3 px-2.5 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20">
          {/* Leg 1 action */}
          {leg1Status === 'scheduled' || leg1Status === 'awaiting_confirmation' ? (
            <ActionLink href={`/matches/${leg1Id}`} label="Leg 1 →" />
          ) : leg1Status === 'completed' || leg1Status === 'walkover' ? (
            <DoneLabel label="✓ L1" />
          ) : null}

          {/* Leg 2 action */}
          {leg2Status === 'pending' ? (
            <span className="text-[9px] text-gray-400 italic">L2 waiting</span>
          ) : leg2Status === 'scheduled' || leg2Status === 'awaiting_confirmation' ? (
            <ActionLink href={`/matches/${leg2Id!}`} label="Leg 2 →" />
          ) : leg2Status === 'completed' || leg2Status === 'walkover' ? (
            <DoneLabel label="✓ L2" />
          ) : null}
        </div>
      )}
    </div>
  )

  // Wrap in link if it's a single-leg match the user can submit
  if (canAct && !hasLegs && (leg1Status === 'scheduled' || leg1Status === 'awaiting_confirmation')) {
    return <Link href={`/matches/${leg1Id}`} className="w-full block">{card}</Link>
  }

  return card
}

// ─── Player Row ───────────────────────────────────────────────────────────────

function PlayerRow({
  name, l1Score, l2Score,
  isWinner, isLoser,
  hasLegs, isFinal,
}: {
  name: string
  l1Score: number | null
  l2Score: number | null
  isWinner: boolean
  isLoser: boolean
  hasLegs: boolean
  isFinal: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-2 transition-opacity ${
        isLoser ? 'opacity-35' : ''
      } ${isWinner ? 'bg-gray-50 dark:bg-white/[0.03]' : ''}`}
    >
      {/* Seed dot */}
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          isWinner ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      />

      {/* Name */}
      <span
        className={`flex-1 text-xs truncate ${
          isWinner
            ? 'font-semibold text-gray-900 dark:text-white'
            : 'font-medium text-gray-600 dark:text-gray-400'
        }`}
      >
        {name || 'TBD'}
      </span>

      {/* Scores */}
      {hasLegs ? (
        <div className="flex items-center gap-0.5 shrink-0">
          <span
            className={`w-6 text-center text-xs tabular-nums font-bold ${
              isWinner ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {l1Score ?? '–'}
          </span>
          <span
            className={`w-6 text-center text-xs tabular-nums font-bold ${
              isWinner ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {l2Score ?? '–'}
          </span>
        </div>
      ) : (
        l1Score !== null && (
          <span
            className={`text-sm tabular-nums font-extrabold shrink-0 ${
              isWinner
                ? isFinal ? 'text-yellow-500' : 'text-brand-500 dark:text-brand-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {l1Score}
          </span>
        )
      )}

      {/* Winner arrow */}
      {isWinner && (
        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 ml-0.5">◄</span>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-[10px] font-bold text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
    >
      {label}
    </Link>
  )
}

function DoneLabel({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-semibold text-green-500 dark:text-green-400">{label}</span>
  )
}
