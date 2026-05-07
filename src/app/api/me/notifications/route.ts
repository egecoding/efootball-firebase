import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type MatchRow = {
  id: string
  player1_id: string | null
  player2_id: string | null
  player1_name: string | null
  player2_name: string | null
  player1_score: number | null
  player2_score: number | null
  played_at: string | null
  tournament_id: string
  tournaments: { title: string } | null
}

type AnnouncementRow = {
  id: string
  tournament_id: string
  message: string
  created_at: string
  tournaments: { title: string } | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 200 })

  const admin = createAdminClient()
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawMatches } = await (admin as any)
    .from('matches')
    .select('id, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, played_at, tournament_id, tournaments(title)')
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .eq('status', 'completed')
    .gte('played_at', since)
    .order('played_at', { ascending: false })
    .limit(10)

  const matches = (rawMatches ?? []) as MatchRow[]

  const { data: participations } = await admin
    .from('participants')
    .select('tournament_id')
    .eq('user_id', user.id)

  const tourIds = (participations ?? []).map((p: { tournament_id: string }) => p.tournament_id)

  let announcements: AnnouncementRow[] = []
  if (tourIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from('tournament_announcements')
      .select('id, tournament_id, message, created_at, tournaments(title)')
      .in('tournament_id', tourIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10)
    announcements = (data ?? []) as AnnouncementRow[]
  }

  const items = [
    ...matches.map((m) => {
      const isP1 = m.player1_id === user.id
      const myScore = isP1 ? m.player1_score : m.player2_score
      const oppScore = isP1 ? m.player2_score : m.player1_score
      const oppName = isP1 ? (m.player2_name ?? 'Opponent') : (m.player1_name ?? 'Opponent')
      const won = (myScore ?? 0) > (oppScore ?? 0)
      const drew = myScore === oppScore
      return {
        id: `match-${m.id}`,
        type: 'match' as const,
        title: drew ? 'Match drawn' : won ? 'Match won 🏆' : 'Match lost',
        body: `${myScore}–${oppScore} vs ${oppName} in ${m.tournaments?.title ?? 'tournament'}`,
        url: `/tournaments/${m.tournament_id}`,
        created_at: m.played_at ?? '',
      }
    }),
    ...announcements.map((a) => ({
      id: `ann-${a.id}`,
      type: 'announcement' as const,
      title: 'Announcement',
      body: a.message,
      url: `/tournaments/${a.tournament_id}`,
      created_at: a.created_at,
    })),
  ].sort((a, b) => (b.created_at > a.created_at ? 1 : -1)).slice(0, 15)

  return NextResponse.json(items)
}
