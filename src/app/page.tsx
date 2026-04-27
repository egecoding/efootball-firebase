import Link from 'next/link'
import { Trophy, Users, Shield, ChevronRight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import { GuestTournamentsList } from '@/components/tournament/GuestTournamentsList'
import type { TournamentWithOrganizer } from '@/types/database'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select(
      'id, organizer_id, title, description, game_name, format, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)'
    )
    .eq('is_public', true)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(6)

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-brand-950">
        <div className="absolute inset-0 dot-grid text-white/[0.03]" />
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 border border-brand-500/20 px-4 py-1.5 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            <span className="text-sm text-brand-400 font-medium">Free to play · Free to host</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-6 tracking-tight leading-[1.05]">
            Run your
            <span className="block gradient-text">eFootball</span>
            Tournament
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Create brackets in seconds. Invite players with a link.
            Track every result.{' '}
            <span className="text-white/70">No account needed to join.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/auth/signup">
              <Button size="lg" className="group gap-2 min-w-[180px]">
                Start a Tournament
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <Link href="/tournaments">
              <Button size="lg" variant="secondary" className="min-w-[180px]">
                Browse Tournaments
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: 'Knockout', emoji: '⚡' },
              { label: 'Round Robin', emoji: '🔄' },
              { label: 'League', emoji: '📋' },
              { label: 'Guest Join', emoji: '🎮' },
            ].map(({ label, emoji }) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-sm text-gray-400">
                {emoji} {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">How it works</h2>
          <p className="text-gray-500 dark:text-gray-400">Running a tournament in 3 steps</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Trophy,
              step: '1',
              title: 'Create',
              description: 'Pick a format, set max players, and instantly get a shareable invite link.',
              color: 'from-brand-500/20 to-brand-600/5 border-brand-500/20',
              iconColor: 'text-brand-500',
            },
            {
              icon: Users,
              step: '2',
              title: 'Invite',
              description: 'Share the link. Players join with just a nametag — no account, no friction.',
              color: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
              iconColor: 'text-blue-400',
            },
            {
              icon: Shield,
              step: '3',
              title: 'Play',
              description: 'Brackets auto-generate. Both players confirm scores. Organizer settles disputes.',
              color: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
              iconColor: 'text-purple-400',
            },
          ].map(({ icon: Icon, step, title, description, color, iconColor }) => (
            <div key={title} className="relative text-center group">
              <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br border ${color} mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <Icon className={`h-7 w-7 ${iconColor}`} />
              </div>
              <div className="absolute -top-2 left-[calc(50%+28px)] h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                {step}
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Formats ──────────────────────────────────────────── */}
      <section className="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-8">3 Tournament Formats</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                emoji: '⚡',
                name: 'Knockout',
                tagColor: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                border: 'border-red-200 dark:border-red-900/60',
                desc: "Single-elimination. Lose once and you're out. Fast and dramatic.",
              },
              {
                emoji: '🔄',
                name: 'Round Robin',
                tagColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                border: 'border-blue-200 dark:border-blue-900/60',
                desc: 'Everyone plays everyone. Most wins takes the crown.',
              },
              {
                emoji: '📋',
                name: 'League',
                tagColor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                border: 'border-purple-200 dark:border-purple-900/60',
                desc: 'Full points table: 3W / 1D / 0L. The real football experience.',
              },
            ].map(({ emoji, name, tagColor, border, desc }) => (
              <div key={name} className={`rounded-xl border ${border} bg-white dark:bg-gray-900 p-5 hover:shadow-md transition-shadow`}>
                <div className="text-3xl mb-3">{emoji}</div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white">{name}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tagColor}`}>{name}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature cards ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Trophy,
              title: 'Auto Brackets',
              description: 'Brackets generate the moment you start. No manual seeding or setup needed.',
            },
            {
              icon: Zap,
              title: 'Instant Invites',
              description: 'One link, no code required. Players join directly from WhatsApp, DMs, or group chats.',
            },
            {
              icon: Shield,
              title: 'Result Verification',
              description: 'Both players confirm the score. Disputes go straight to the organizer to resolve.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl p-6 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-800 hover:shadow-sm transition-all">
              <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-brand-500" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Guest: "Your Tournaments" (reads localStorage client-side) ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10">
        <GuestTournamentsList />
      </div>

      {/* ── Open tournaments ─────────────────────────────────── */}
      {tournaments && tournaments.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Open Tournaments</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Join now — no account needed</p>
            </div>
            <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600 font-medium">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(tournaments as unknown as TournamentWithOrganizer[]).map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}

      {/* ── CTA banner ───────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800">
        <div className="absolute inset-0 dot-grid text-white/[0.05]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Ready to run your tournament?</h2>
          <p className="text-brand-200 mb-8 max-w-md mx-auto">Set up in 60 seconds. Free forever. No credit card.</p>
          <Link href="/auth/signup">
            <Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50 border-0 font-bold gap-2">
              Get Started Free
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
