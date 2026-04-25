import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ManagePanel } from '@/components/tournament/ManagePanel'
import type { TournamentWithOrganizer, ParticipantWithProfile } from '@/types/database'

interface PageProps {
  params: { id: string }
}

export default async function ManageTournamentPage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: tournament }, { data: participants }] = await Promise.all([
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
  ])

  if (!tournament) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedTournament = tournament as any as TournamentWithOrganizer

  if (typedTournament.organizer_id !== user.id) {
    redirect(`/tournaments/${params.id}`)
  }

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
          baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''}
        />
      </div>
    </div>
  )
}
