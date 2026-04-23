'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { AvatarUpload } from './AvatarUpload'
import { StatsCard } from './StatsCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Profile } from '@/types/database'

interface OwnProfileViewProps {
  profile: Profile
}

export function OwnProfileView({ profile }: OwnProfileViewProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const supabase = getClient()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('id', profile.id)

    setSaving(false)
    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Saved!')
      router.refresh()
      setTimeout(() => setMessage(''), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <AvatarUpload
          userId={profile.id}
          currentUrl={avatarUrl}
          displayName={displayName || profile.username}
          onUpload={(url) => {
            setAvatarUrl(url)
            router.refresh()
          }}
        />
      </div>

      {/* Info */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Account
        </h2>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <Input
            label="Username"
            value={profile.username}
            disabled
            hint="Username cannot be changed"
          />
          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name shown in tournaments"
          />
          {message && (
            <p
              className={`text-sm ${
                message === 'Saved!'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-500'
              }`}
            >
              {message}
            </p>
          )}
          <Button type="submit" loading={saving} size="md">
            Save Changes
          </Button>
        </form>
      </div>

      {/* Stats */}
      <StatsCard profile={profile} />
    </div>
  )
}
