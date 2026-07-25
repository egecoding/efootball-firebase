import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkSuperAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const admin = createAdminClient()

  // This route reads with the service-role client, which bypasses RLS — so it has
  // to enforce visibility itself, or a private tournament's announcements are
  // readable by anyone who knows the tournament id.
  const { data: tournament } = await admin
    .from('tournaments')
    .select('organizer_id, is_public')
    .eq('id', params.id)
    .single()

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  }

  if (!tournament.is_public) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let allowed = false

    if (user) {
      allowed = tournament.organizer_id === user.id
      if (!allowed) {
        const { data: membership } = await admin
          .from('participants')
          .select('id')
          .eq('tournament_id', params.id)
          .eq('user_id', user.id)
          .maybeSingle()
        allowed = !!membership || (await checkSuperAdmin(user.id))
      }
    } else {
      // Guests identify with the participant id they were issued on join.
      const participantId = req.headers.get('X-Participant-Id')
      if (participantId) {
        const { data: participant } = await admin
          .from('participants')
          .select('id')
          .eq('id', participantId)
          .eq('tournament_id', params.id)
          .maybeSingle()
        allowed = !!participant
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('tournament_announcements')
    .select('id, message, created_at')
    .eq('tournament_id', params.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: tournament }, superAdmin] = await Promise.all([
    admin.from('tournaments').select('organizer_id').eq('id', params.id).single(),
    checkSuperAdmin(user.id),
  ])

  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.organizer_id !== user.id && !superAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  if (message.length > 500) return NextResponse.json({ error: 'Message too long (max 500 chars)' }, { status: 400 })

  const { data, error } = await admin
    .from('tournament_announcements')
    .insert({ tournament_id: params.id, organizer_id: user.id, message })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
