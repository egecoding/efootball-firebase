import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin_user = await requireSuperAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()

  const [
    { count: totalUsers },
    { count: totalTournaments },
    { count: totalMatches },
    { count: completedMatches },
    { count: pushSubs },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('tournaments').select('*', { count: 'exact', head: true }),
    db.from('matches').select('*', { count: 'exact', head: true }),
    db.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    db.from('push_subscriptions').select('*', { count: 'exact', head: true }),
  ])

  const { data: recentTournamentsRaw } = await db
    .from('tournaments')
    .select('id, title, status, format, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  const recentTournaments = (recentTournamentsRaw ?? []).map((t) => ({ ...t, name: t.title }))

  return NextResponse.json({
    totalUsers,
    totalTournaments,
    totalMatches,
    completedMatches,
    pushSubs,
    recentTournaments,
  })
}
