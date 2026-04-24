'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { X, Copy, Check, Share2 } from 'lucide-react'
import type { TournamentFormat } from '@/types/database'

interface TournamentFormData {
  title: string
  description: string
  game_name: string
  max_participants: number
  is_public: boolean
  starts_at: string
  format: TournamentFormat
}

const FORMAT_OPTIONS: { value: TournamentFormat; label: string; desc: string }[] = [
  { value: 'knockout', label: 'Knockout', desc: "Single-elimination bracket. Lose once and you're out." },
  { value: 'round_robin', label: 'Round Robin', desc: 'Everyone plays everyone. Most wins takes the title.' },
  { value: 'league', label: 'League', desc: 'Everyone plays everyone. Points: 3W / 1D / 0L.' },
]

export function TournamentForm() {
  const router = useRouter()
  const [form, setForm] = useState<TournamentFormData>({
    title: '',
    description: '',
    game_name: 'eFootball',
    max_participants: 8,
    is_public: true,
    starts_at: '',
    format: 'knockout',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [playerInput, setPlayerInput] = useState('')
  const [players, setPlayers] = useState<string[]>([])
  const playerInputRef = useRef<HTMLInputElement>(null)

  // Post-creation share state
  const [created, setCreated] = useState<{ id: string; invite_code: string; title: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  function update<K extends keyof TournamentFormData>(field: K, value: TournamentFormData[K]) {
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
      body: JSON.stringify({ ...form, starts_at: form.starts_at || null }),
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

    setCreated({ id: tournament.id, invite_code: tournament.invite_code, title: tournament.title })
    setLoading(false)
  }

  // --- Share card shown after creation ---
  if (created) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
    const inviteLink = `${baseUrl}/tournaments/${created.id}/join?code=${created.invite_code}`
    const shareText = `Join "${created.title}"! Tap the link to register: ${inviteLink}`

    const copyLink = async () => {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
    const shareWhatsApp = () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
    }
    const shareNative = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: created!.title, url: inviteLink }) } catch { /* cancelled */ }
      } else {
        await navigator.clipboard.writeText(inviteLink)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      }
    }

    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">Tournament created!</p>
          <p className="text-sm text-green-700 dark:text-green-400">Share this link — no code needed.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
            {inviteLink}
          </div>
          <button
            onClick={copyLink}
            className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 p-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={shareWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-[#25D366] hover:bg-[#1ebe5d] text-white transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share on WhatsApp
          </button>
          <button
            onClick={shareNative}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        <Button onClick={() => router.push(`/tournaments/${created.id}/manage`)} variant="secondary" size="lg">
          Go to Dashboard →
        </Button>
      </div>
    )
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
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Tell players what to expect…"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Format selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Format</label>
        <div className="flex flex-col gap-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('format', opt.value)}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                form.format === opt.value
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                form.format === opt.value ? 'border-brand-500' : 'border-gray-400'
              }`}>
                {form.format === opt.value && <div className="h-2 w-2 rounded-full bg-brand-500" />}
              </div>
              <div>
                <p className={`text-sm font-medium ${form.format === opt.value ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Game"
        value={form.game_name}
        onChange={(e) => update('game_name', e.target.value)}
        placeholder="eFootball"
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max participants</label>
        <div className="grid grid-cols-4 gap-2">
          {[4, 8, 16, 32].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update('max_participants', n)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                form.max_participants === n
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600'
              }`}
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
          className={`relative h-6 w-11 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
            form.is_public ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'
          }`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            form.is_public ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">Public tournament (visible to everyone)</span>
      </div>

      {/* Add Players */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Add players{' '}
          <span className="font-normal text-gray-400">(optional · {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left)</span>
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
          <Button type="button" variant="secondary" onClick={addPlayer} disabled={slotsLeft <= 0}>Add</Button>
        </div>
        {players.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {players.map((name) => (
              <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm px-3 py-1">
                {name}
                <button type="button" onClick={() => removePlayer(name)} className="hover:text-brand-900 dark:hover:text-brand-100">
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

      <Button type="submit" loading={loading} size="lg">Create Tournament</Button>
    </form>
  )
}
