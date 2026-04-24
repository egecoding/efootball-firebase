import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const supabase = await createClient()

  let qb = supabase
    .from('tournaments')
    .select(
      'id, organizer_id, title, description, game_name, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)',
      { count: 'exact' }
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.trim()) {
    qb = qb.textSearch('title', query.trim(), {
      type: 'websearch',
      config: 'english',
    })
  }

  const { data, error, count } = await qb

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, game_name, max_participants, is_public, starts_at, format } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (!Number.isInteger(max_participants) || max_participants < 2 || max_participants > 128) {
    return NextResponse.json(
      { error: 'max_participants must be a whole number between 2 and 128' },
      { status: 400 }
    )
  }
  const validFormats = ['knockout', 'round_robin', 'league']
  const resolvedFormat = validFormats.includes(format) ? format : 'knockout'

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      organizer_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      game_name: game_name?.trim() || 'eFootball',
      max_participants,
      format: resolvedFormat,
      is_public: is_public ?? true,
      starts_at: starts_at || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
