import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/participants/lookup?name=PhilEFC
// Returns all tournaments a guest player has joined, matched by nametag.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (name.length < 2) return NextResponse.json({ error: 'Name too short' }, { status: 400 })

  const db = createAdminClient()

  const { data, error } = await db
    .from('participants')
    .select('id, name, tournament_id, tournaments(id, title, status, game_name, format)')
    .ilike('name', name)
    .is('user_id', null)
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = (data ?? []).map((p) => ({
    participantId: p.id,
    name: p.name,
    tournament: p.tournaments,
  }))

  return NextResponse.json({ results })
}
