import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/matches/[id]/predict
// Returns aggregate prediction counts + the current user's pick (if logged in).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from('match_predictions')
    .select('predicted_slot, user_id')
    .eq('match_id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const predictions = rows ?? []
  const player1_count = predictions.filter((r) => r.predicted_slot === 1).length
  const player2_count = predictions.filter((r) => r.predicted_slot === 2).length
  const total = predictions.length

  const userRow = user ? predictions.find((r) => r.user_id === user.id) : null
  const user_slot = userRow ? userRow.predicted_slot : null

  return NextResponse.json({ player1_count, player2_count, total, user_slot })
}

// POST /api/matches/[id]/predict
// Body: { predicted_slot: 1 | 2 }
// Auth required. Upserts the user's prediction (one vote per user per match).
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { predicted_slot } = body
  if (predicted_slot !== 1 && predicted_slot !== 2) {
    return NextResponse.json({ error: 'predicted_slot must be 1 or 2' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch match to verify it exists and get player IDs
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, player1_id, player2_id, status')
    .eq('id', params.id)
    .single()

  if (matchErr || !match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (!['scheduled', 'awaiting_confirmation'].includes(match.status)) {
    return NextResponse.json({ error: 'Predictions are closed for this match' }, { status: 409 })
  }

  const predicted_winner_id = predicted_slot === 1 ? match.player1_id : match.player2_id

  const { error: upsertErr } = await admin
    .from('match_predictions')
    .upsert(
      {
        match_id: params.id,
        user_id: user.id,
        predicted_slot,
        predicted_winner_id,
      },
      { onConflict: 'match_id,user_id' }
    )

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  // Return updated counts
  const { data: rows } = await admin
    .from('match_predictions')
    .select('predicted_slot')
    .eq('match_id', params.id)

  const predictions = rows ?? []
  const player1_count = predictions.filter((r) => r.predicted_slot === 1).length
  const player2_count = predictions.filter((r) => r.predicted_slot === 2).length
  const total = predictions.length

  return NextResponse.json({ player1_count, player2_count, total, user_slot: predicted_slot })
}
