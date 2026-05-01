import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  ai_score_confidence: string | null        // 'high' | 'low' | null — set by Gemini after screenshot upload
  screenshotSignedUrl: string | null        // from finalized match row
  submissionScreenshotSignedUrl: string | null // from result_submissions (pre-finalization)
  submittedByName: string | null            // who submitted the pending screenshot
  round_name: string | null
  round_number: number | null
  round_phase: string | null                // 'group' | 'knockout' | 'winners' | 'losers' | 'grand_final' | 'league' | 'playoff'
  group_name: string | null                 // group stage: 'A', 'B', etc.
  bracket: string | null                    // 'winners' | 'losers' | 'grand_final' | 'league' | 'playoff'
  tie_id: string | null                     // two-legged ties
  leg: number | null                        // 1 or 2
}

export default async function ManageTournamentPage({ params }: PageProps) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Check super admin status — use admin client to bypass RLS on profiles
  const { data: profile } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
  const isSuperAdmin = !!(profile as { is_super_admin?: boolean } | null)?.is_super_admin

  // Use admin client to bypass RLS — organizers are sometimes blocked by policy mismatches
  const [{ data: tournament }, { data: participants }, { data: rawMatches }] = await Promise.all([
    admin
      .from('tournaments')
      .select(
        'id, organizer_id, title, description, game_name, format, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
      )
      .eq('id', params.id)
      .single(),
    admin
      .from('participants')
      .select(
        'id, tournament_id, user_id, name, seed, joined_at, profiles(id, username, display_name, avatar_url, wins, losses, created_at, updated_at)'
      )
      .eq('tournament_id', params.id)
      .order('joined_at', { ascending: true }),
    admin
      .from('matches')
      .select('id, match_number, player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, status, screenshot_url, ai_score_confidence, group_name, bracket, tie_id, leg, rounds(round_number, round_name, phase)')
      .eq('tournament_id', params.id)
      .in('status', ['scheduled', 'awaiting_confirmation', 'completed', 'walkover'])
      .order('match_number', { ascending: true }),
  ])

  if (!tournament) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedTournament = tournament as any as TournamentWithOrganizer

  if (typedTournament.organizer_id !== user.id && !isSuperAdmin) {
    redirect(`/tournaments/${params.id}`)
  }

  // Fetch result_submissions for all matches so we can show screenshots
  // submitted by players even before the match is finalized
  const matchIds = (rawMatches ?? []).map((m: { id: string }) => m.id)
  const { data: submissions } = matchIds.length
    ? await supabase
        .from('result_submissions')
        .select('match_id, screenshot_url, submitted_by, profiles(display_name, username)')
        .in('match_id', matchIds)
        .not('screenshot_url', 'is', null)
    : { data: [] }

  // Build a lookup: match_id → first submission that has a screenshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissionByMatch = new Map<string, { screenshot_url: string; submittedByName: string | null }>()
  for (const sub of (submissions ?? []) as any[]) {
    if (!submissionByMatch.has(sub.match_id)) {
      const prof = sub.profiles as { display_name?: string | null; username?: string | null } | null
      submissionByMatch.set(sub.match_id, {
        screenshot_url: sub.screenshot_url,
        submittedByName: prof?.display_name ?? prof?.username ?? null,
      })
    }
  }

  // Generate signed URLs for screenshots.
  // Rule: completed match → screenshotSignedUrl (plain confirmed image)
  //       awaiting_confirmation → submissionScreenshotSignedUrl (yellow "Review & Confirm" card)
  //         sources: result_submissions (registered player) OR matches.screenshot_url (guest)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: ManageMatch[] = await Promise.all((rawMatches ?? []).map(async (m: any) => {
    let screenshotSignedUrl: string | null = null
    let submissionScreenshotSignedUrl: string | null = null
    let submittedByName: string | null = null

    const submission = submissionByMatch.get(m.id)

    if (m.status === 'completed' && m.screenshot_url) {
      // Finalized — show as a confirmed screenshot (no action needed)
      const { data: signed } = await supabase.storage
        .from('screenshots')
        .createSignedUrl(m.screenshot_url, 60 * 60)
      screenshotSignedUrl = signed?.signedUrl ?? null
    } else if (m.status === 'awaiting_confirmation') {
      if (submission) {
        // Registered player submitted via result_submissions
        const { data: signed } = await supabase.storage
          .from('screenshots')
          .createSignedUrl(submission.screenshot_url, 60 * 60)
        submissionScreenshotSignedUrl = signed?.signedUrl ?? null
        submittedByName = submission.submittedByName
      } else if (m.screenshot_url) {
        // Guest submitted directly to the match row — still needs organizer confirmation
        const { data: signed } = await supabase.storage
          .from('screenshots')
          .createSignedUrl(m.screenshot_url, 60 * 60)
        submissionScreenshotSignedUrl = signed?.signedUrl ?? null
        // name unknown for guests — card will read "Screenshot submitted — pending your confirmation"
      }
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
      ai_score_confidence: m.ai_score_confidence ?? null,
      screenshotSignedUrl,
      submissionScreenshotSignedUrl,
      submittedByName,
      round_name: m.rounds?.round_name ?? null,
      round_number: m.rounds?.round_number ?? null,
      round_phase: m.rounds?.phase ?? null,
      group_name: m.group_name ?? null,
      bracket: m.bracket ?? null,
      tie_id: m.tie_id ?? null,
      leg: m.leg ?? null,
    }
  }))

  return (
    <div className="page-container">
      <div className="max-w-2xl mx-auto">
        <h1 className="section-title mb-2">Manage Tournament</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          {typedTournament.title}
        </p>
        {isSuperAdmin && typedTournament.organizer_id !== user.id && (
          <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            👑 You are viewing this as <strong>Super Admin</strong> — you are not the organizer.
          </div>
        )}
        <ManagePanel
          tournament={typedTournament}
          participants={(participants as unknown as ParticipantWithProfile[]) ?? []}
          matches={matches}
          isSuperAdmin={isSuperAdmin}
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
