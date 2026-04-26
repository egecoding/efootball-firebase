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

  const body = await request.json()
  const { invite_code, name } = body

  if (!invite_code) {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
  }

  // Guest join requires a nametag
  if (!user) {
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName) {
      return NextResponse.json({ error: 'Nametag is required to join as a guest' }, { status: 400 })
    }
  }

  // Fetch tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, status, invite_code, max_participants')
    .eq('id', params.id)
    .single()

  if (tErr || !tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  }

  if (tournament.invite_code !== invite_code.trim().toUpperCase()) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
  }

  if (tournament.status !== 'open') {
    return NextResponse.json(
      { error: 'Tournament is not accepting participants' },
      { status: 409 }
    )
  }

  // Check capacity
  const { count } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', params.id)

  if ((count ?? 0) >= tournament.max_participants) {
    return NextResponse.json({ error: 'Tournament is full' }, { status: 409 })
  }

  const participantRow = user
    ? { tournament_id: params.id, user_id: user.id }
    : { tournament_id: params.id, user_id: null, name: (name as string).trim() }

  const { data: inserted, error: joinError } = await supabase
    .from('participants')
    .insert(participantRow)
    .select('id')
    .single()

  if (joinError) {
    if (joinError.code === '23505') {
      // Already joined — find existing row and return its id
      const query = user
        ? supabase.from('participants').select('id').eq('tournament_id', params.id).eq('user_id', user.id).single()
        : supabase.from('participants').select('id').eq('tournament_id', params.id).eq('name', (name as string).trim()).order('joined_at', { ascending: false }).limit(1).single()
      const { data: existing } = await query
      return NextResponse.json({ participant_id: existing?.id ?? null, already_joined: true })
    }
    return NextResponse.json({ error: joinError.message }, { status: 500 })
  }

  return NextResponse.json({ participant_id: inserted?.id ?? null })
}
