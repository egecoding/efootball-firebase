import Link from 'next/link'
import { Trophy, Users, Zap, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import type { TournamentWithOrganizer } from '@/types/database'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select(
      'id, organizer_id, title, description, game_name, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
    )
    .eq('is_public', true)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(6)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-brand-950 dark:from-gray-950 dark:via-gray-900 dark:to-brand-950">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 border border-brand-500/20 px-4 py-1.5 mb-6">
            <Zap className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-sm text-brand-400 font-medium">
              Free to play, free to host
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Run your eFootball
            <br />
            <span className="text-brand-400">Tournament</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10">
            Create tournaments in seconds, generate brackets automatically, and
            track every match result. Free for everyone.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg">Start a Tournament</Button>
            </Link>
            <Link href="/tournaments">
              <Button size="lg" variant="secondary">
                Browse Tournaments
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Trophy,
              title: 'Auto Brackets',
              description:
                'Single-elimination brackets generated instantly when you start your tournament.',
            },
            {
              icon: Users,
              title: 'Invite Links',
              description:
                'Share a unique invite code or link. Players join in one click.',
            },
            {
              icon: Shield,
              title: 'Result Verification',
              description:
                'Both players confirm the score. Disputes go to the organizer.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl p-6 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
            >
              <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-brand-500" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Open tournaments */}
      {tournaments && tournaments.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Open Tournaments
            </h2>
            <Link
              href="/tournaments"
              className="text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(tournaments as unknown as TournamentWithOrganizer[]).map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
