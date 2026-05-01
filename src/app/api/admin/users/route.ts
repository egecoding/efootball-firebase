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

  const db = createAdminClient()

  let query = db
    .from('profiles')
    .select('id, username, display_name, avatar_url, wins, losses, is_super_admin, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
  }

  const { data: users, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users, count, page, limit })
}

// PATCH /api/admin/users — toggle is_super_admin
export async function PATCH(req: Request) {
  const admin_user = await requireSuperAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, is_super_admin } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('profiles').update({ is_super_admin }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
