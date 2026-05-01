'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Trophy, BarChart3, Bell, Search, ChevronLeft, ChevronRight, Shield, ShieldOff } from 'lucide-react'

type Tab = 'overview' | 'users' | 'tournaments' | 'notifications'

interface Stats {
  totalUsers: number
  totalTournaments: number
  totalMatches: number
  completedMatches: number
  pushSubs: number
  recentTournaments: { id: string; name: string; status: string; format: string; created_at: string }[]
}

interface User {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  wins: number
  losses: number
  is_super_admin: boolean
  created_at: string
}

interface Tournament {
  id: string
  name: string
  status: string
  format: string
  created_at: string
  profiles: { username: string; display_name: string | null } | null
}

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
              <Shield className="h-4 w-4 text-brand-400" />
            </div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
          </div>
          <p className="text-gray-400 text-sm">Monitor and manage the entire platform</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-900 rounded-xl p-1 w-fit">
          {([
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'tournaments', label: 'Tournaments', icon: Trophy },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'overview' && <OverviewTab stats={stats} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'tournaments' && <TournamentsTab />}
        {tab === 'notifications' && <NotificationsTab />}
      </div>
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="text-gray-500 animate-pulse">Loading stats…</div>

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
    { label: 'Tournaments', value: stats.totalTournaments, icon: Trophy, color: 'text-brand-400' },
    { label: 'Matches Played', value: stats.completedMatches, sub: `of ${stats.totalMatches} total`, icon: BarChart3, color: 'text-purple-400' },
    { label: 'Push Subscribers', value: stats.pushSubs, icon: Bell, color: 'text-yellow-400' },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <Icon className={`h-5 w-5 mb-3 ${color}`} />
            <p className="text-2xl font-bold">{value ?? 0}</p>
            {sub && <p className="text-xs text-gray-500">{sub}</p>}
            <p className="text-sm text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3 text-gray-300">Recent Tournaments</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Format</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recentTournaments ?? []).map((t) => (
                <tr key={t.id} className="border-b border-gray-800/50 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3">
                    <a href={`/tournaments/${t.id}`} className="hover:text-brand-400 transition-colors">{t.name}</a>
                  </td>
                  <td className="px-5 py-3 text-gray-400 capitalize">{t.format}</td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true)
    const res = await fetch(`/api/admin/users?page=${p}&q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setUsers(data.users ?? [])
    setCount(data.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load(page, query) }, [page, query, load])

  async function toggleAdmin(userId: string, current: boolean) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, is_super_admin: !current }),
    })
    load(page, query)
  }

  const totalPages = Math.ceil(count / 20)

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setQuery(search) } }}
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <button
          onClick={() => { setPage(1); setQuery(search) }}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-xl text-sm font-medium transition-colors"
        >
          Search
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-500 font-medium">User</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">W / L</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Joined</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Admin</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500 animate-pulse">Loading…</td></tr>
            )}
            {!loading && users.map((u) => (
              <tr key={u.id} className="border-b border-gray-800/50 last:border-0 hover:bg-white/5">
                <td className="px-5 py-3">
                  <p className="font-medium">{u.display_name || u.username}</p>
                  <p className="text-xs text-gray-500">@{u.username}</p>
                </td>
                <td className="px-5 py-3 text-gray-400">{u.wins}W / {u.losses}L</td>
                <td className="px-5 py-3 text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  {u.is_super_admin
                    ? <span className="inline-flex items-center gap-1 text-xs text-brand-400"><Shield className="h-3 w-3" /> Admin</span>
                    : <span className="text-xs text-gray-600">—</span>}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggleAdmin(u.id, u.is_super_admin)}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      u.is_super_admin
                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                        : 'border-brand-500/30 text-brand-400 hover:bg-brand-500/10'
                    }`}
                  >
                    {u.is_super_admin ? <><ShieldOff className="h-3 w-3" /> Revoke</> : <><Shield className="h-3 w-3" /> Make Admin</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{count} users total</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tournaments ───────────────────────────────────────────────────────────────

function TournamentsTab() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p: number, q: string, s: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), q, status: s })
    const res = await fetch(`/api/admin/tournaments?${params}`)
    const data = await res.json()
    setTournaments(data.tournaments ?? [])
    setCount(data.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load(page, query, status) }, [page, query, status, load])

  const totalPages = Math.ceil(count / 20)

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search tournaments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setQuery(search) } }}
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
        <button
          onClick={() => { setPage(1); setQuery(search) }}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-xl text-sm font-medium transition-colors"
        >
          Search
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Tournament</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Organizer</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Format</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Created</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500 animate-pulse">Loading…</td></tr>
            )}
            {!loading && tournaments.map((t) => (
              <tr key={t.id} className="border-b border-gray-800/50 last:border-0 hover:bg-white/5">
                <td className="px-5 py-3">
                  <a href={`/tournaments/${t.id}`} className="font-medium hover:text-brand-400 transition-colors">{t.name}</a>
                </td>
                <td className="px-5 py-3 text-gray-400">
                  {t.profiles?.display_name || t.profiles?.username || '—'}
                </td>
                <td className="px-5 py-3 text-gray-400 capitalize">{t.format}</td>
                <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-5 py-3 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <a
                    href={`/tournaments/${t.id}/manage`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 transition-colors"
                  >
                    Manage →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{count} tournaments total</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notifications ─────────────────────────────────────────────────────────────

function NotificationsTab() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/')
  const [tournamentId, setTournamentId] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; message?: string } | null>(null)
  const [error, setError] = useState('')

  async function send() {
    if (!title.trim() || !body.trim()) { setError('Title and body are required'); return }
    setSending(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, url, tournamentId: tournamentId.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to send'); return }
      setResult(data)
      setTitle('')
      setBody('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-base mb-1">Send Push Notification</h2>
          <p className="text-xs text-gray-500">Leave Tournament ID blank to broadcast to all subscribers.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tournament starts soon!"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Message *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Round 1 kicks off in 30 minutes. Check your matches!"
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Link URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tournament ID <span className="text-gray-600">(optional — leave blank for global broadcast)</span></label>
            <input
              type="text"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              placeholder="Paste tournament UUID to target only its participants"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <div className="rounded-xl bg-brand-500/10 border border-brand-500/30 px-4 py-3 text-sm text-brand-300">
            {result.message ?? `Sent to ${result.sent} subscriber${result.sent !== 1 ? 's' : ''}`}
          </div>
        )}

        <button
          onClick={send}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl text-sm font-bold transition-colors"
        >
          <Bell className="h-4 w-4" />
          {sending ? 'Sending…' : tournamentId ? 'Send to Tournament' : 'Broadcast to All'}
        </button>
      </div>

      {/* Notification presets explanation */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold text-base mb-4">Automatic Notification Triggers</h2>
        <div className="space-y-3 text-sm">
          {[
            { emoji: '⚽', event: 'Player submits a result', who: 'Organizer', msg: '"A player submitted a result — ready for your confirmation"' },
            { emoji: '✅', event: 'Organizer confirms a result', who: 'Both players', msg: '"You won/lost X–Y" or "Match ended X–Y (draw)"' },
            { emoji: '🎮', event: 'Winner advances in knockout', who: 'Both next-match players', msg: '"Your next match (#N) is scheduled. Good luck!"' },
          ].map(({ emoji, event, who, msg }) => (
            <div key={event} className="flex gap-3 p-3 bg-gray-800/50 rounded-xl">
              <span className="text-lg shrink-0">{emoji}</span>
              <div>
                <p className="font-medium text-gray-200">{event}</p>
                <p className="text-xs text-gray-500 mt-0.5">Notifies: <span className="text-gray-400">{who}</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Message: <span className="text-gray-400">{msg}</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-700 text-gray-300',
    active: 'bg-brand-500/20 text-brand-300',
    completed: 'bg-blue-500/20 text-blue-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${styles[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}
