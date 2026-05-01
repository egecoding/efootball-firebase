import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkSuperAdmin } from '@/lib/admin-guard'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is the organizer or super admin
  const admin = createAdminClient()
  const [{ data: tournament }, superAdmin] = await Promise.all([
    admin.from('tournaments').select('organizer_id, max_participants, status').eq('id', params.id).single(),
    checkSuperAdmin(user.id),
  ])

  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.organizer_id !== user.id && !superAdmin)
    return NextResponse.json({ error: 'Only the organizer can add participants' }, { status: 403 })
  if (tournament.status !== 'open')
    return NextResponse.json({ error: 'Tournament is not open' }, { status: 400 })

  const body = await request.json()
  const name: string | undefined = body.name?.trim()

  if (!name) return NextResponse.json({ error: 'Player name is required' }, { status: 400 })

  // Check capacity
  const { count } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', params.id)

  if ((count ?? 0) >= tournament.max_participants)
    return NextResponse.json({ error: 'Tournament is full' }, { status: 400 })

  const { error } = await supabase
    .from('participants')
    .insert({ tournament_id: params.id, name, user_id: null })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('participants')
    .select('id, tournament_id, user_id, name, seed, joined_at, profiles(id, username, display_name, avatar_url, wins, losses)')
    .eq('tournament_id', params.id)
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const participantId = searchParams.get('participantId')
  const userId = searchParams.get('userId')

  let query = supabase
    .from('participants')
    .delete()
    .eq('tournament_id', params.id)

  if (participantId) {
    // Guest removal by participant row id (organizer only)
    query = query.eq('id', participantId)
  } else {
    // Registered user removal by user_id
    query = query.eq('user_id', userId ?? user.id)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
