import Link from 'next/link'
import { Trophy, Users, Shield, ChevronRight, Zap, Star, CheckCircle, BarChart2, Award } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import { GuestTournamentsList } from '@/components/tournament/GuestTournamentsList'
import { FormatTabs } from '@/components/tournament/FormatTabs'
import type { TournamentWithOrganizer } from '@/types/database'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: tournaments }, { count: tournamentCount }, { count: playerCount }] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, organizer_id, title, description, game_name, format, max_participants, status, invite_code, is_public, starts_at, created_at, updated_at, profiles(id, username, display_name, avatar_url)')
      .eq('is_public', true)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase.from('participants').select('*', { count: 'exact', head: true }),
  ])

  const totalTournaments = tournamentCount ?? 0
  const totalPlayers = playerCount ?? 0

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-brand-950" id="home">
        <div className="absolute inset-0 dot-grid text-white/[0.03]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-emerald-400/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — text */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 border border-brand-500/20 px-4 py-1.5 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-sm text-brand-400 font-medium">Free to play · Free to host</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight leading-[1.08]">
                Run your
                <span className="block gradient-text">eFootball</span>
                Tournament
              </h1>

              <p className="text-lg text-gray-400 max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed">
                Create brackets in seconds. Invite players with a link.
                Track every result.{' '}
                <span className="text-white/70">No account needed to join.</span>
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
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

              {/* Guest lookup */}
              <div className="max-w-sm mx-auto lg:mx-0 mb-6">
                <GuestTournamentsList />
              </div>

              {/* Format pills */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2">
                {[
                  { label: 'Knockout', emoji: '⚡' },
                  { label: 'Round Robin', emoji: '🔄' },
                  { label: 'League', emoji: '📋' },
                  { label: 'Guest Join', emoji: '🎮' },
                ].map(({ label, emoji }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-gray-400">
                    {emoji} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — CSS browser mockup */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-full max-w-md">
                {/* Glow behind mockup */}
                <div className="absolute inset-0 bg-brand-500/10 rounded-3xl blur-2xl" />

                {/* Browser window */}
                <div className="relative rounded-2xl border border-white/10 bg-gray-900/90 backdrop-blur-sm shadow-2xl overflow-hidden">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 border-b border-white/10">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-500/70" />
                      <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                      <div className="h-3 w-3 rounded-full bg-green-500/70" />
                    </div>
                    <div className="flex-1 mx-3 h-5 rounded bg-gray-700/60 flex items-center px-3">
                      <span className="text-[10px] text-gray-500">efootballcup.vercel.app/tournaments/…</span>
                    </div>
                  </div>

                  {/* Bracket preview */}
                  <div className="p-5 bg-gray-950/50">
                    {/* Tournament header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-sm font-bold text-white">eFCup Launch</div>
                        <div className="text-[10px] text-brand-400 font-medium mt-0.5">● In Progress</div>
                      </div>
                      <div className="text-xs bg-brand-500/15 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">Knockout</div>
                    </div>

                    {/* Bracket columns */}
                    <div className="flex gap-3 items-start">
                      {/* QF */}
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider text-center mb-1">Quarter</div>
                        {[['Barca', '7'], ['Jals', '6'], ['Koffy', '8'], ['Ian', '2']].map(([name, score], i) => (
                          <div key={i} className={`rounded-lg px-2 py-1.5 border ${i % 2 === 0 ? 'border-brand-500/30 bg-brand-500/5' : 'border-white/5 bg-white/3'} flex items-center justify-between`}>
                            <span className="text-[10px] text-gray-300 font-medium truncate">{name}</span>
                            <span className={`text-[10px] font-bold ${i % 2 === 0 ? 'text-brand-400' : 'text-gray-500'}`}>{score}</span>
                          </div>
                        ))}
                      </div>

                      {/* SF */}
                      <div className="flex-1 flex flex-col gap-2 mt-4">
                        <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider text-center mb-1">Semi</div>
                        {[['Barca', '4'], ['Koffy', '4']].map(([name, score], i) => (
                          <div key={i} className={`rounded-lg px-2 py-1.5 border ${i === 0 ? 'border-brand-500/30 bg-brand-500/5' : 'border-white/5 bg-white/3'} flex items-center justify-between mb-2`}>
                            <span className="text-[10px] text-gray-300 font-medium truncate">{name}</span>
                            <span className={`text-[10px] font-bold ${i === 0 ? 'text-brand-400' : 'text-gray-500'}`}>{score}</span>
                          </div>
                        ))}
                      </div>

                      {/* Final */}
                      <div className="flex-1 flex flex-col mt-8">
                        <div className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider text-center mb-2">🏆 Final</div>
                        <div className="rounded-xl px-2 py-2 border border-amber-500/40 bg-amber-500/5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-white font-bold">Barca 👑</span>
                            <span className="text-[10px] font-bold text-brand-400">7</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">Koffy</span>
                            <span className="text-[10px] text-gray-500">0</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom stat row */}
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] text-gray-600">8 players · 7 matches</span>
                      <span className="text-[10px] text-brand-500 font-medium">Completed ✓</span>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -bottom-3 -right-3 bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-brand-500/30">
                  Live Brackets ⚡
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────── */}
      <section className="bg-gray-900 border-y border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                {totalTournaments > 0 ? `${totalTournaments}+` : '—'}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 uppercase tracking-wider font-medium">Tournaments Hosted</p>
            </div>
            <div className="border-x border-gray-800">
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                {totalPlayers > 0 ? `${totalPlayers}+` : '—'}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 uppercase tracking-wider font-medium">Players Joined</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold gradient-text">Free</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 uppercase tracking-wider font-medium">Forever</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20" id="how-it-works">
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">Simple process</span>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">How it works</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">Running a tournament takes 60 seconds. Here's all you need to do.</p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Connecting dashed line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-[calc(16.7%+24px)] right-[calc(16.7%+24px)] h-px border-t-2 border-dashed border-gray-200 dark:border-gray-800 pointer-events-none" />

          {[
            {
              icon: Trophy,
              step: '01',
              title: 'Create',
              description: 'Pick a format, set max players, and instantly get a shareable invite link.',
              color: 'from-brand-500/20 to-brand-600/5 border-brand-500/30',
              iconColor: 'text-brand-500',
              numColor: 'text-brand-400',
            },
            {
              icon: Users,
              step: '02',
              title: 'Invite',
              description: 'Share the link. Players join with just a nametag — no account, no friction.',
              color: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
              iconColor: 'text-blue-400',
              numColor: 'text-blue-400',
            },
            {
              icon: Shield,
              step: '03',
              title: 'Play',
              description: 'Brackets auto-generate. Both players confirm scores. Organizer settles disputes.',
              color: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
              iconColor: 'text-purple-400',
              numColor: 'text-purple-400',
            },
          ].map(({ icon: Icon, step, title, description, color, iconColor, numColor }) => (
            <div key={title} className="relative flex flex-col items-center text-center group">
              <div className={`relative inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br border ${color} mb-5 group-hover:scale-105 transition-transform duration-200 shadow-sm`}>
                <Icon className={`h-8 w-8 ${iconColor}`} />
                <div className={`absolute -top-3 -right-3 h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-[10px] font-extrabold ${numColor}`}>
                  {step}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">Everything included</span>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Everything you need</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">All the tools to run professional-grade tournaments — completely free.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Trophy,
                color: 'bg-brand-500/10 text-brand-500',
                title: 'Auto Brackets',
                description: 'Brackets generate the moment you start. No manual seeding or setup needed.',
              },
              {
                icon: Zap,
                color: 'bg-yellow-500/10 text-yellow-500',
                title: 'Instant Invites',
                description: 'One link, no code required. Players join directly from WhatsApp, DMs, or group chats.',
              },
              {
                icon: Shield,
                color: 'bg-blue-500/10 text-blue-400',
                title: 'Result Verification',
                description: 'Both players confirm the score. Disputes go straight to the organizer to resolve.',
              },
              {
                icon: Users,
                color: 'bg-purple-500/10 text-purple-400',
                title: 'Guest Join',
                description: 'No account needed. Players join with just a nametag — zero friction for participants.',
              },
              {
                icon: BarChart2,
                color: 'bg-emerald-500/10 text-emerald-400',
                title: 'Live Standings',
                description: 'Real-time standings tables for league and round-robin formats. Always up to date.',
              },
              {
                icon: Award,
                color: 'bg-amber-500/10 text-amber-400',
                title: 'Award Cards',
                description: 'Generate shareable Winner and Top Scorer cards at the end of each tournament.',
              },
            ].map(({ icon: Icon, color, title, description }) => (
              <div
                key={title}
                className="rounded-2xl p-6 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-800 hover:shadow-md transition-all group"
              >
                <div className={`h-11 w-11 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tournament Formats (tabbed) ───────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">Flexible formats</span>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Pick your format</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">From quick knockouts to full league seasons — choose the format that fits your group.</p>
        </div>
        <FormatTabs />
      </section>

      {/* ── Open tournaments ─────────────────────────────────── */}
      {tournaments && tournaments.length > 0 && (
        <section className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40" id="tournaments">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-2">Live now</span>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Open Tournaments</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Join now — no account needed</p>
              </div>
              <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600 font-semibold">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(tournaments as unknown as TournamentWithOrganizer[]).map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Social proof / trust bar ─────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Why organizers choose eFootball Cup</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Simple, fast, and built specifically for eFootball communities.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: CheckCircle, color: 'text-brand-500', title: 'No setup fees', desc: 'Create unlimited tournaments for free, forever.' },
              { icon: Star, color: 'text-yellow-500', title: 'Built for eFootball', desc: 'Designed for the specific needs of eFootball communities.' },
              { icon: Zap, color: 'text-blue-400', title: 'Instant start', desc: 'Tournament goes live the second you hit start — no delays.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <Icon className={`h-5 w-5 ${color} shrink-0 mt-0.5`} />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800">
        <div className="absolute inset-0 dot-grid text-white/[0.05]" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 mb-6">
            <span className="text-sm text-white/80 font-medium">100% Free · No credit card</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">Ready to run your tournament?</h2>
          <p className="text-brand-200 mb-10 max-w-md mx-auto text-lg">Set up in 60 seconds. Share one link. Let the games begin.</p>
          <Link href="/auth/signup">
            <Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50 border-0 font-bold gap-2 shadow-xl">
              Get Started Free
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
