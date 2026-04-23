'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'

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

  function update<K extends keyof TournamentFormData>(
    field: K,
    value: TournamentFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }))
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

    const data = await res.json()
    router.push(`/tournaments/${data.id}/manage`)
    router.refresh()
  }

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

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Max participants
        </label>
        <div className="flex gap-2">
          {[4, 8, 16, 32].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update('max_participants', n)}
              className={cn(
                'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                form.max_participants === n
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

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
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
            form.is_public ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              form.is_public ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Public tournament (visible to everyone)
        </span>
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
