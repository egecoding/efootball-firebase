'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Loader2 } from 'lucide-react'
import { getClient } from '@/lib/supabase/client'

interface AvatarUploadProps {
  userId: string
  currentUrl?: string | null
  displayName?: string | null
  onUpload: (url: string) => void
}

export function AvatarUpload({ userId, currentUrl, displayName, onUpload }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setError('')
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const supabase = getClient()

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600',
      })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path)

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      onUpload(publicUrl)
    }

    setUploading(false)
  }

  const src = preview ?? currentUrl

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="relative h-24 w-24 rounded-full overflow-hidden bg-brand-500/10 flex items-center justify-center">
          {src ? (
            <Image
              src={src}
              alt={displayName ?? 'Avatar'}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <span className="text-2xl font-bold text-brand-500">
              {displayName?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors shadow-md"
          aria-label="Upload avatar"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Click camera to upload (max 2 MB)
      </p>
    </div>
  )
}
