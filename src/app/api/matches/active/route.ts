import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/matches/active
// Returns the current user's scheduled/awaiting_confirmation matches (for share-target picker)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 200 })

  const admin = createAdminClient()

  const { data: matches } = await admin
    .from('matches')
    .select('id, match_number, player1_id, player1_name, player2_id, player2_name, status, tournaments(title)')
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .in('status', ['scheduled', 'awaiting_confirmation'])
    .order('created_at', { ascending: false })
    .limit(10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (matches ?? []).map((m: any) => ({
    id: m.id,
    match_number: m.match_number,
    player1_name: m.player1_name,
    player2_name: m.player2_name,
    status: m.status,
    tournament_title: m.tournaments?.title ?? null,
  }))

  return NextResponse.json(result)
}
