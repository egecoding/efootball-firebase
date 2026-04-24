import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is the organizer
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('organizer_id, max_participants, status')
    .eq('id', params.id)
    .single()

  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.organizer_id !== user.id)
    return NextResponse.json({ error: 'Only the organizer can add participants' }, { status: 403 })
  if (tournament.status !== 'open')
    return NextResponse.json({ error: 'Tournament is not open' }, { status: 400 })

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Check capacity
  const { count } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', params.id)

  if ((count ?? 0) >= tournament.max_participants)
    return NextResponse.json({ error: 'Tournament is full' }, { status: 400 })

  const { error } = await supabase
    .from('participants')
    .insert({ tournament_id: params.id, user_id: userId })

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'User is already a participant' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('participants')
    .select('id, tournament_id, user_id, seed, joined_at, profiles(id, username, display_name, avatar_url, wins, losses)')
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
  const userId = searchParams.get('userId') ?? user.id

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('tournament_id', params.id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
