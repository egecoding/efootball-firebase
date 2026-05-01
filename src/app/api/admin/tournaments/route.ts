import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const admin_user = await requireSuperAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit
  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''

  const db = createAdminClient()

  let query = db
    .from('tournaments')
    .select('id, title, status, format, created_at, organizer_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) query = query.ilike('title', `%${search}%`)
  if (status) query = query.eq('status', status)

  const { data: tournaments, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const organizerIds = Array.from(new Set((tournaments ?? []).map((t) => t.organizer_id).filter(Boolean)))
  let profileMap: Record<string, { username: string; display_name: string | null }> = {}
  if (organizerIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username, display_name')
      .in('id', organizerIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = { username: p.username, display_name: p.display_name }
    }
  }

  const result = (tournaments ?? []).map((t) => ({
    ...t,
    name: t.title,
    profiles: profileMap[t.organizer_id] ?? null,
  }))

  return NextResponse.json({ tournaments: result, count, page, limit })
}
