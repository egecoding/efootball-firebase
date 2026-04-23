'use client'

import { useState, useRef } from 'react'
import { ImagePlus, Check, X } from 'lucide-react'
import { getClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'

interface ScreenshotUploadProps {
  matchId: string
  userId: string
  onUpload: (path: string | null) => void
}

export function ScreenshotUpload({ matchId, userId, onUpload }: ScreenshotUploadProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('uploading')
    setFileName(file.name)

    const ext = file.name.split('.').pop()
    const path = `${userId}/${matchId}.${ext}`

    const supabase = getClient()
    const { error } = await supabase.storage
      .from('screenshots')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) {
      setStatus('error')
      onUpload(null)
      return
    }

    setStatus('done')
    onUpload(path)
  }

  function clear() {
    setStatus('idle')
    setFileName('')
    onUpload(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Screenshot (optional)
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
        id="screenshot-upload"
      />

      {status === 'idle' && (
        <label
          htmlFor="screenshot-upload"
          className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors"
        >
          <ImagePlus className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Upload match screenshot
          </span>
        </label>
      )}

      {status === 'uploading' && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
          <Spinner size="sm" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Uploading {fileName}…
          </span>
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="flex-1 text-sm text-green-700 dark:text-green-400 truncate">
            {fileName}
          </span>
          <button
            type="button"
            onClick={clear}
            className="text-green-600 dark:text-green-400 hover:text-red-500 transition-colors"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <span className="flex-1 text-sm text-red-700 dark:text-red-400">
            Upload failed. Try again.
          </span>
          <button type="button" onClick={clear} className="text-red-600 hover:text-red-800 dark:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
