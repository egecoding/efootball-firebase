import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { NOINDEX } from '@/lib/seo'
import { OwnProfileView } from '@/components/profile/OwnProfileView'
import type { Profile } from '@/types/database'

export const metadata: Metadata = {
  title: 'Your Profile',
  robots: NOINDEX,
}

export default async function OwnProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirectTo=/profile')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, wins, losses, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  return (
    <div className="page-container">
      <div className="max-w-lg mx-auto">
        <h1 className="section-title mb-8">My Profile</h1>
        <OwnProfileView profile={profile as Profile} />
      </div>
    </div>
  )
}
