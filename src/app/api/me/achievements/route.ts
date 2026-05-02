import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcTopScorer, calcStandings, type MatchRow } from '@/lib/utils/card-helpers'

export const dynamic = 'force-dynamic'

export interface Achievement {
  tournamentId: string
  tournamentTitle: string
  isWinner: boolean
  isTopScorer: boolean
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Completed tournaments the user participates in
  const { data: participations } = await admin
    .from('participants')
    .select('tournament_id, tournaments(id, title, format, status, organizer_id)')
    .eq('user_id', user.id)

  // Completed tournaments the user organized
  const { data: organized } = await admin
    .from('tournaments')
    .select('id, title, format, status, organizer_id')
    .eq('organizer_id', user.id)
    .eq('status', 'completed')

  // Merge and deduplicate completed tournaments
  const tournamentMap = new Map<string, { id: string; title: string; format: string }>()

  for (const p of participations ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = p.tournaments as any
    if (t && t.status === 'completed') {
      tournamentMap.set(t.id, { id: t.id, title: t.title, format: t.format ?? 'knockout' })
    }
  }
  for (const t of organized ?? []) {
    tournamentMap.set(t.id, { id: t.id, title: t.title, format: t.format ?? 'knockout' })
  }

  if (tournamentMap.size === 0) {
    return NextResponse.json([])
  }

  const tournamentIds = Array.from(tournamentMap.keys())

  // Fetch all participants (for profile map) and matches in one go
  const [{ data: allParticipants }, { data: rawMatches }] = await Promise.all([
    admin
      .from('participants')
      .select('user_id, tournament_id, name, profiles(id, display_name, username, avatar_url)')
      .in('tournament_id', tournamentIds),
    admin
      .from('matches')
      .select('tournament_id, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, winner_id, status, rounds(round_number)')
      .in('tournament_id', tournamentIds)
      .eq('status', 'completed'),
  ])

  // Build profile map per tournament
  const profileMapByTournament = new Map<string, Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>>()
  for (const p of allParticipants ?? []) {
    if (!p.user_id) continue
    if (!profileMapByTournament.has(p.tournament_id)) profileMapByTournament.set(p.tournament_id, new Map())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prof = p.profiles as any
    profileMapByTournament.get(p.tournament_id)!.set(p.user_id, {
      display_name: prof?.display_name ?? null,
      username: prof?.username ?? null,
      avatar_url: prof?.avatar_url ?? null,
    })
  }

  // Group matches by tournament
  const matchesByTournament = new Map<string, (MatchRow & { winner_id?: string | null; round_number?: number })[]>()
  for (const m of rawMatches ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tm = m as any
    if (!matchesByTournament.has(tm.tournament_id)) matchesByTournament.set(tm.tournament_id, [])
    matchesByTournament.get(tm.tournament_id)!.push({
      player1_id: tm.player1_id,
      player1_name: tm.player1_name,
      player2_id: tm.player2_id,
      player2_name: tm.player2_name,
      player1_score: tm.player1_score,
      player2_score: tm.player2_score,
      winner_id: tm.winner_id,
      round_number: tm.rounds?.round_number ?? 0,
    })
  }

  const achievements: Achievement[] = []

  for (const [tId, t] of Array.from(tournamentMap.entries())) {
    const matches = matchesByTournament.get(tId) ?? []
    const profileMap = profileMapByTournament.get(tId) ?? new Map()

    // Determine winner
    let winnerId: string | null = null
    if (t.format === 'knockout' || t.format === 'double_elimination' || t.format === 'group_knockout' || t.format === 'champions_league') {
      // Last round's completed match winner
      const sorted = [...matches].sort((a, b) => (b.round_number ?? 0) - (a.round_number ?? 0))
      const finalMatch = sorted.find((m) => m.winner_id)
      winnerId = finalMatch?.winner_id ?? null
    } else {
      // League / round robin: standings leader
      const standings = calcStandings(matches, t.format, profileMap)
      winnerId = standings[0]?.id ?? null
    }

    // Determine top scorer
    const topScorer = calcTopScorer(matches, profileMap)
    const topScorerId = topScorer && topScorer.gf > 0 ? topScorer.id : null

    const isWinner = !!winnerId && winnerId === user.id
    const isTopScorer = !!topScorerId && topScorerId === user.id

    if (isWinner || isTopScorer) {
      achievements.push({
        tournamentId: tId,
        tournamentTitle: t.title,
        isWinner,
        isTopScorer,
      })
    }
  }

  return NextResponse.json(achievements)
}
