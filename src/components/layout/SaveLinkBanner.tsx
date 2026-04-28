'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

interface Props {
  tournamentId: string
}

export function SaveLinkBanner({ tournamentId }: Props) {
  const searchParams = useSearchParams()
  const [show, setShow] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!searchParams.get('newjoin')) return
    const pid = localStorage.getItem(`participant_${tournamentId}`)
    if (!pid) return

    const url = `${window.location.origin}/tournaments/${tournamentId}/portal?pid=${pid}`
    setLink(url)
    setShow(true)

    // Strip ?newjoin from URL
    const clean = new URL(window.location.href)
    clean.searchParams.delete('newjoin')
    window.history.replaceState({}, '', clean.toString())
  }, [tournamentId, searchParams])

  if (!show) return null

  return (
    <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-950/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xl shrink-0">🔗</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-300 mb-0.5">Save your personal link</p>
            <p className="text-xs text-amber-400/80 leading-snug mb-3">
              No account? Bookmark this link — it&apos;s the only way back to your matches if you close this page.
            </p>
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-0 bg-gray-900/60 rounded-xl px-3 py-1.5 text-xs text-gray-300 font-mono truncate">
                {link}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
              {'share' in navigator && (
                <button
                  onClick={() => navigator.share({ title: 'My Tournament Portal', url: link })}
                  className="shrink-0 rounded-xl bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs font-bold text-gray-200 transition-colors"
                >
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setShow(false)} className="shrink-0 text-amber-500/60 hover:text-amber-400 transition-colors mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
