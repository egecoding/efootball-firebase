'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { X } from 'lucide-react'

interface TournamentFormData {
  title: string
  description: string
  game_name: string
  max_participants: number
  is_public: boolean
  starts_at: string
}

export function TournamentForm() {
  const router = useRouter()
  const [form, setForm] = useState<TournamentFormData>({
    title: '',
    description: '',
    game_name: 'eFootball',
    max_participants: 8,
    is_public: true,
    starts_at: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [playerInput, setPlayerInput] = useState('')
  const [players, setPlayers] = useState<string[]>([])
  const playerInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof TournamentFormData>(
    field: K,
    value: TournamentFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addPlayer() {
    const name = playerInput.trim()
    if (!name || players.includes(name)) return
    if (players.length >= form.max_participants - 1) return
    setPlayers((prev) => [...prev, name])
    setPlayerInput('')
    playerInputRef.current?.focus()
  }

  function removePlayer(name: string) {
    setPlayers((prev) => prev.filter((p) => p !== name))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        starts_at: form.starts_at || null,
      }),
    })

    if (!res.ok) {
      const { error: msg } = await res.json()
      setError(msg)
      setLoading(false)
      return
    }

    const tournament = await res.json()

    for (const name of players) {
      await fetch(`/api/tournaments/${tournament.id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    }

    router.push(`/tournaments/${tournament.id}/manage`)
    router.refresh()
  }

  const slotsLeft = form.max_participants - 1 - players.length

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Tournament title"
        required
        value={form.title}
        onChange={(e) => update('title', e.target.value)}
        placeholder="Sunday League Cup"
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Description
        </label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Tell players what to expect…"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
        />
      </div>

      <Input
        label="Game"
        value={form.game_name}
        onChange={(e) => update('game_name', e.target.value)}
        placeholder="eFootball"
      />

      <Input
        label="Max participants"
        type="number"
        min={2}
        max={128}
        required
        value={form.max_participants}
        onChange={(e) => update('max_participants', Math.max(2, parseInt(e.target.value) || 2))}
      />

      <Input
        label="Start date (optional)"
        type="datetime-local"
        value={form.starts_at}
        onChange={(e) => update('starts_at', e.target.value)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={form.is_public}
          onClick={() => update('is_public', !form.is_public)}
          className={`relative h-6 w-11 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
            form.is_public ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              form.is_public ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Public tournament (visible to everyone)
        </span>
      </div>

      {/* Add Players */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Add players{' '}
          <span className="font-normal text-gray-400">
            (optional · {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left)
          </span>
        </label>
        <div className="flex gap-2">
          <input
            ref={playerInputRef}
            type="text"
            value={playerInput}
            onChange={(e) => setPlayerInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }}
            placeholder="Player name or tag…"
            disabled={slotsLeft <= 0}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
          />
          <Button type="button" variant="secondary" onClick={addPlayer} disabled={slotsLeft <= 0}>
            Add
          </Button>
        </div>
        {players.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {players.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm px-3 py-1"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removePlayer(name)}
                  className="hover:text-brand-900 dark:hover:text-brand-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} size="lg">
        Create Tournament
      </Button>
    </form>
  )
}
