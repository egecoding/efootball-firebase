import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns the current user's profile if they are a super admin, null otherwise.
 * Use in API routes and server components to gate admin access.
 */
export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, display_name, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) return null
  return profile
}
