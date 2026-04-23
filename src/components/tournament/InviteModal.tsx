'use client'

import { useState } from 'react'
import { Copy, Check, Link as LinkIcon } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface InviteModalProps {
  open: boolean
  onClose: () => void
  inviteCode: string
  tournamentId: string
}

export function InviteModal({ open, onClose, inviteCode, tournamentId }: InviteModalProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const inviteLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/tournaments/${tournamentId}/join?code=${inviteCode}`
      : ''

  async function copy(type: 'code' | 'link') {
    const text = type === 'code' ? inviteCode : inviteLink
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite Players">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Share this code or link with players you want to invite.
          </p>
        </div>

        {/* Code */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Invite Code
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 font-mono text-lg tracking-widest font-bold text-gray-900 dark:text-white text-center">
              {inviteCode}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copy('code')}
              className="shrink-0"
            >
              {copied === 'code' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copy('link')}
              className="shrink-0"
            >
              {copied === 'link' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <LinkIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
