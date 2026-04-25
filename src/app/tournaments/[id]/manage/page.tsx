import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ManagePanel } from '@/components/tournament/ManagePanel'
import type { TournamentWithOrganizer, ParticipantWithProfile } from '@/types/database'

interface PageProps {
  params: { id: string }
}

export type ManageMatch = {
  id: string
  match_number: number
  player1_id: string | null
  player1_name: string | null
  player2_id: string | null
  player2_name: string | null
  player1_score: number | null
  player2_score: number | null
  status: string
  screenshot_url: string | null
  screenshotSignedUrl: string | null
  round_name: string | null
}

export default async function ManageTournamentPage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: tournament }, { data: participants }, { data: rawMatches }] = await Promise.all([
    supabase
      .from('tournaments')
      .select(
        'id, organizer_id, title, description, game_name, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
      )
      .eq('id', params.id)
      .single(),
    supabase
      .from('participants')
      .select(
        'id, tournament_id, user_id, name, seed, joined_at, profiles(id, username, display_name, avatar_url, wins, losses, created_at, updated_at)'
      )
      .eq('tournament_id', params.id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('matches')
      .select('id, match_number, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, status, screenshot_url, rounds(round_name)')
      .eq('tournament_id', params.id)
      .in('status', ['scheduled', 'awaiting_confirmation', 'completed'])
      .order('created_at', { ascending: true }),
  ])

  if (!tournament) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedTournament = tournament as any as TournamentWithOrganizer

  if (typedTournament.organizer_id !== user.id) {
    redirect(`/tournaments/${params.id}`)
  }

  // Generate signed URLs for screenshots
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: ManageMatch[] = await Promise.all((rawMatches ?? []).map(async (m: any) => {
    let screenshotSignedUrl: string | null = null
    if (m.screenshot_url) {
      const { data: signed } = await supabase.storage
        .from('screenshots')
        .createSignedUrl(m.screenshot_url, 60 * 60)
      screenshotSignedUrl = signed?.signedUrl ?? null
    }
    return {
      id: m.id,
      match_number: m.match_number,
      player1_id: m.player1_id,
      player1_name: m.player1_name,
      player2_id: m.player2_id,
      player2_name: m.player2_name,
      player1_score: m.player1_score,
      player2_score: m.player2_score,
      status: m.status,
      screenshot_url: m.screenshot_url,
      screenshotSignedUrl,
      round_name: m.rounds?.round_name ?? null,
    }
  }))

  return (
    <div className="page-container">
      <div className="max-w-2xl mx-auto">
        <h1 className="section-title mb-2">Manage Tournament</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          {typedTournament.title}
        </p>
        <ManagePanel
          tournament={typedTournament}
          participants={(participants as unknown as ParticipantWithProfile[]) ?? []}
          matches={matches}
          baseUrl={
            process.env.NEXT_PUBLIC_APP_URL ??
            (process.env.VERCEL_PROJECT_PRODUCTION_URL
              ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
              : '')
          }
        />
      </div>
    </div>
  )
}
