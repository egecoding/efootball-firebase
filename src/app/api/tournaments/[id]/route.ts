import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkSuperAdmin } from '@/lib/admin-guard'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tournaments')
    .select(
      'id, organizer_id, title, description, game_name, format, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
    )
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: tournament }, superAdmin] = await Promise.all([
    admin.from('tournaments').select('organizer_id').eq('id', params.id).single(),
    checkSuperAdmin(user.id),
  ])

  if (!tournament || (tournament.organizer_id !== user.id && !superAdmin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const allowed = ['title', 'description', 'status', 'starts_at', 'is_public', 'game_name']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await admin
    .from('tournaments')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: tournament }, superAdmin] = await Promise.all([
    admin.from('tournaments').select('organizer_id').eq('id', params.id).single(),
    checkSuperAdmin(user.id),
  ])

  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (tournament.organizer_id !== user.id && !superAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin.from('tournaments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
