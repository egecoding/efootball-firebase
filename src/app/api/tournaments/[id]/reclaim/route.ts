import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/tournaments/[id]/reclaim?name=PhilEFC
// Returns participant_id for a guest player by name in this tournament.
// No auth required — guests have no account.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const db = createAdminClient()

  const { data, error } = await db
    .from('participants')
    .select('id, name')
    .eq('tournament_id', params.id)
    .ilike('name', name)
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No participant found with that name' }, { status: 404 })
  }

  return NextResponse.json({ participant_id: data.id, name: data.name })
}
