'use client'

import { useState, useEffect } from 'react'
import { Megaphone, Send } from 'lucide-react'

interface Announcement {
  id: string
  message: string
  created_at: string
}

interface AnnouncementBannerProps {
  tournamentId: string
  isOrganizer: boolean
}

export function AnnouncementBanner({ tournamentId, isOrganizer }: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/announcements`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAnnouncements(d) })
  }, [tournamentId])

  async function post() {
    if (!text.trim()) return
    setPosting(true)
    const res = await fetch(`/api/tournaments/${tournamentId}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() }),
    })
    if (res.ok) {
      const a = await res.json()
      setAnnouncements((prev) => [a, ...prev])
      setText('')
    }
    setPosting(false)
  }

  if (!isOrganizer && announcements.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
        <Megaphone className="h-4 w-4" />
        Announcements
      </div>
      {isOrganizer && (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Post an announcement to all participants..."
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }}
          />
          <button
            onClick={post}
            disabled={posting || !text.trim()}
            className="rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-3 py-2 text-white"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
      {announcements.map((a) => (
        <div key={a.id} className="text-sm text-amber-800 dark:text-amber-300 bg-white/60 dark:bg-amber-950/30 rounded-lg px-3 py-2">
          <span className="font-medium">{a.message}</span>
          <span className="ml-2 text-xs text-amber-500 dark:text-amber-500">
            {new Date(a.created_at).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  )
}
