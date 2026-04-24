'use client'

import { useState } from 'react'
import { Copy, Check, Link as LinkIcon, Share2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface InviteModalProps {
  open: boolean
  onClose: () => void
  inviteCode: string
  tournamentId: string
  tournamentTitle?: string
}

export function InviteModal({ open, onClose, inviteCode, tournamentId, tournamentTitle }: InviteModalProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const inviteLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/tournaments/${tournamentId}/join?code=${inviteCode}`
      : ''

  const shareText = `Join ${tournamentTitle ? `"${tournamentTitle}"` : 'my tournament'}! Tap the link to register: ${inviteLink}`

  async function copy(type: 'code' | 'link') {
    const text = type === 'code' ? inviteCode : inviteLink
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  async function shareNative() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: tournamentTitle ?? 'Tournament', url: inviteLink })
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(inviteLink)
      setCopied('link')
      setTimeout(() => setCopied(null), 2000)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite Players">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Share the link — no code needed, it&apos;s already included.
        </p>

        {/* Code */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Invite Code
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 font-mono text-lg tracking-widest font-bold text-gray-900 dark:text-white text-center">
              {inviteCode}
            </div>
            <Button variant="secondary" size="sm" onClick={() => copy('code')} className="shrink-0">
              {copied === 'code' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Link */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Invite Link
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
              {inviteLink}
            </div>
            <Button variant="secondary" size="sm" onClick={() => copy('link')} className="shrink-0">
              {copied === 'link' ? <Check className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Share buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={shareWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-[#25D366] hover:bg-[#1ebe5d] text-white transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
          <button
            onClick={shareNative}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>
    </Modal>
  )
}
