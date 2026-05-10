'use client'

import { useState, useEffect } from 'react'

interface PredictionBarProps {
  matchId: string
  player1Name: string
  player2Name: string
  matchStatus: string
  matchWinnerId: string | null
  player1Id: string | null
  player2Id: string | null
  currentUserId: string | null
}

interface PredictionData {
  player1_count: number
  player2_count: number
  total: number
  user_slot: 1 | 2 | null
}

export function PredictionBar({
  matchId,
  player1Name,
  player2Name,
  matchStatus,
  matchWinnerId,
  player1Id,
  player2Id,
  currentUserId,
}: PredictionBarProps) {
  const [data, setData] = useState<PredictionData | null>(null)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')

  const isCompleted = matchStatus === 'completed' || matchStatus === 'walkover'
  const canVote = !!currentUserId && !isCompleted

  useEffect(() => {
    fetch(`/api/matches/${matchId}/predict`)
      .then((r) => r.json())
      .then((d) => {
        if (d.total !== undefined) setData(d)
      })
      .catch(() => {/* non-fatal */})
  }, [matchId])

  async function vote(slot: 1 | 2) {
    if (!canVote || voting) return
    setVoting(true)
    setError('')
    const res = await fetch(`/api/matches/${matchId}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predicted_slot: slot }),
    })
    const d = await res.json()
    setVoting(false)
    if (!res.ok) { setError(d.error ?? 'Failed to submit prediction'); return }
    setData(d)
  }

  // Determine correct winner slot (1 or 2) from winner_id
  const winnerSlot = isCompleted && matchWinnerId
    ? matchWinnerId === player1Id ? 1 : matchWinnerId === player2Id ? 2 : null
    : null

  const p1Pct = data && data.total > 0 ? Math.round((data.player1_count / data.total) * 100) : 50
  const p2Pct = data && data.total > 0 ? Math.round((data.player2_count / data.total) * 100) : 50

  return (
    <div className="mx-0 mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-4 py-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 text-center">
        {isCompleted ? 'Prediction Results' : 'Who do you think will win?'}
      </p>

      {/* Pick buttons — only show for logged-in users before match ends */}
      {canVote && (
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => vote(1)}
            disabled={voting}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all truncate ${
              data?.user_slot === 1
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 ring-2 ring-brand-400/50'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400 hover:bg-white dark:hover:bg-gray-800'
            } disabled:opacity-60`}
          >
            {player1Name}
            {data?.user_slot === 1 && ' ✓'}
          </button>
          <button
            onClick={() => vote(2)}
            disabled={voting}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all truncate ${
              data?.user_slot === 2
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 ring-2 ring-brand-400/50'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400 hover:bg-white dark:hover:bg-gray-800'
            } disabled:opacity-60`}
          >
            {player2Name}
            {data?.user_slot === 2 && ' ✓'}
          </button>
        </div>
      )}

      {/* Prediction bar */}
      {data && data.total > 0 ? (
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            {/* Player 1 correct/wrong indicator */}
            {isCompleted && data.user_slot === 1 && (
              <span className="text-xs shrink-0">{winnerSlot === 1 ? '✅' : '❌'}</span>
            )}
            <span className={`text-xs font-medium truncate min-w-0 ${data.user_slot === 1 ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {player1Name}
            </span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0 ml-1">{p1Pct}%</span>
            <div className="flex-1 mx-1 sm:mx-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden min-w-[48px]">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${p1Pct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0 mr-1">{p2Pct}%</span>
            <span className={`text-xs font-medium truncate min-w-0 text-right ${data.user_slot === 2 ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {player2Name}
            </span>
            {isCompleted && data.user_slot === 2 && (
              <span className="text-xs shrink-0 ml-1">{winnerSlot === 2 ? '✅' : '❌'}</span>
            )}
          </div>
          <p className="text-[10px] text-center text-gray-400 dark:text-gray-500">
            {data.total} {data.total === 1 ? 'prediction' : 'predictions'}
          </p>
        </div>
      ) : (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500">
          {!currentUserId ? 'Log in to predict the winner.' : 'Be the first to predict!'}
        </p>
      )}

      {error && <p className="text-xs text-red-500 text-center mt-2">{error}</p>}
    </div>
  )
}
