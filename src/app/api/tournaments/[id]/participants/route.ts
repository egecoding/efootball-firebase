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

// PATCH /api/tournaments/[id]/participants
// Lets the organizer rename/replace a participant slot (e.g. swap out a no-show)
// after the tournament has started, at any point — including after they've
// already played some matches. Only their not-yet-played (pending/scheduled)
// matches pick up the new name; completed/awaiting-confirmation/walkover
// matches keep whoever was actually on the board when they were played, so
// match history and standings stay accurate.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: tournament }, superAdmin] = await Promise.all([
    admin.from('tournaments').select('organizer_id, status').eq('id', params.id).single(),
    checkSuperAdmin(user.id),
  ])

  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.organizer_id !== user.id && !superAdmin)
    return NextResponse.json({ error: 'Only the organizer can edit participants' }, { status: 403 })
  if (tournament.status === 'completed')
    return NextResponse.json({ error: 'Tournament has ended' }, { status: 400 })

  const body = await request.json()
  const participantId: string | undefined = body.participantId
  const newName: string | undefined = body.name?.trim()

  if (!participantId || !newName)
    return NextResponse.json({ error: 'participantId and name are required' }, { status: 400 })

  const { data: participant } = await admin
    .from('participants')
    .select('id, tournament_id, user_id, name')
    .eq('id', participantId)
    .eq('tournament_id', params.id)
    .single()

  if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })

  const { data: allMatches } = await admin
    .from('matches')
    .select('id, player1_id, player1_name, player2_id, player2_name, status')
    .eq('tournament_id', params.id)

  const isThisParticipant = (pid: string | null, pname: string | null) =>
    participant.user_id ? pid === participant.user_id : pid === null && pname === participant.name

  const { error: updateParticipantError } = await admin
    .from('participants')
    .update({ name: newName, user_id: null })
    .eq('id', participantId)

  if (updateParticipantError)
    return NextResponse.json({ error: updateParticipantError.message }, { status: 500 })

  // Only matches that haven't been played yet get the new name — a completed,
  // awaiting-confirmation or walkover match already has a real score attached
  // to whoever was on the board, and rewriting that would misattribute it to
  // the substitute.
  const unplayedStatuses = new Set(['pending', 'scheduled'])
  const matchIdsAsP1 = (allMatches ?? [])
    .filter((m) => unplayedStatuses.has(m.status) && isThisParticipant(m.player1_id, m.player1_name))
    .map((m) => m.id)
  const matchIdsAsP2 = (allMatches ?? [])
    .filter((m) => unplayedStatuses.has(m.status) && isThisParticipant(m.player2_id, m.player2_name))
    .map((m) => m.id)

  if (matchIdsAsP1.length > 0) {
    await admin.from('matches').update({ player1_id: null, player1_name: newName }).in('id', matchIdsAsP1)
  }
  if (matchIdsAsP2.length > 0) {
    await admin.from('matches').update({ player2_id: null, player2_name: newName }).in('id', matchIdsAsP2)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const participantId = searchParams.get('participantId')
  const userId = searchParams.get('userId')

  // Organizer/super admin can remove any participant; players can only remove themselves
  const isRemovingSelf = !participantId && (userId === user.id || !userId)

  const adminClient = createAdminClient()

  if (!isRemovingSelf) {
    const [{ data: tournament }, superAdmin] = await Promise.all([
      adminClient.from('tournaments').select('organizer_id').eq('id', params.id).single(),
      checkSuperAdmin(user.id),
    ])
    if (!tournament || (tournament.organizer_id !== user.id && !superAdmin))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Once a tournament has started, block removing a participant who has
    // already played — their match history would otherwise reference a
    // vanished roster entry. Not-yet-played participants can still be
    // swapped out (e.g. a no-show).
    const { data: participant } = await adminClient
      .from('participants')
      .select('id, user_id, name')
      .eq('tournament_id', params.id)
      .eq('id', participantId ?? '')
      .maybeSingle()

    const target = participant ?? (userId
      ? (await adminClient.from('participants').select('id, user_id, name').eq('tournament_id', params.id).eq('user_id', userId).maybeSingle()).data
      : null)

    if (target) {
      const { data: allMatches } = await adminClient
        .from('matches')
        .select('player1_id, player1_name, player2_id, player2_name, status')
        .eq('tournament_id', params.id)

      const isThisParticipant = (pid: string | null, pname: string | null) =>
        target.user_id ? pid === target.user_id : pid === null && pname === target.name

      const hasPlayed = (allMatches ?? []).some((m) => {
        if (m.status !== 'completed' && m.status !== 'walkover' && m.status !== 'awaiting_confirmation') return false
        return isThisParticipant(m.player1_id, m.player1_name) || isThisParticipant(m.player2_id, m.player2_name)
      })

      if (hasPlayed)
        return NextResponse.json(
          { error: 'This participant has already played a match and can no longer be removed.' },
          { status: 409 }
        )
    }
  }

  let query = adminClient
    .from('participants')
    .delete()
    .eq('tournament_id', params.id)

  if (participantId) {
    query = query.eq('id', participantId)
  } else {
    query = query.eq('user_id', userId ?? user.id)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
