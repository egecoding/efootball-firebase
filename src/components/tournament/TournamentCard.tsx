import Link from 'next/link'
import { Users, Calendar, Zap } from 'lucide-react'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import type { TournamentWithOrganizer } from '@/types/database'

interface TournamentCardProps {
  tournament: TournamentWithOrganizer
  participantCount?: number
}

const FORMAT_META: Record<string, { emoji: string; label: string; pill: string; bar: string; accent: string }> = {
  knockout:    { emoji: '⚡', label: 'Knockout',    pill: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',       bar: 'bg-red-500',    accent: 'border-t-red-400 dark:border-t-red-600' },
  round_robin: { emoji: '🔄', label: 'Round Robin', pill: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',   bar: 'bg-blue-500',   accent: 'border-t-blue-400 dark:border-t-blue-600' },
  league:      { emoji: '📋', label: 'League',      pill: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400', bar: 'bg-purple-500', accent: 'border-t-purple-400 dark:border-t-purple-600' },
}

export function TournamentCard({ tournament, participantCount }: TournamentCardProps) {
  const organizer = tournament.profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const format = (tournament as any).format as string | undefined
  const meta = format ? FORMAT_META[format] : null

  const slotsFilled = participantCount ?? null
  const slotsTotal = tournament.max_participants
  const fillPct = slotsFilled !== null ? Math.round((slotsFilled / slotsTotal) * 100) : null

  return (
    <Link href={`/tournaments/${tournament.id}`} className="group block">
      <div className={`h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-all duration-200 group-hover:shadow-lg group-hover:shadow-black/5 dark:group-hover:shadow-black/30 group-hover:border-gray-300 dark:group-hover:border-gray-700 group-hover:-translate-y-0.5 overflow-hidden ${meta ? `border-t-2 ${meta.accent}` : ''}`}>

        <div className="flex flex-col gap-3 p-5 flex-1">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 flex-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {tournament.title}
            </h3>
            <TournamentStatusBadge status={tournament.status} />
          </div>

          {/* Format + game */}
          <div className="flex items-center gap-2 flex-wrap">
            {meta && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.pill}`}>
                {meta.emoji} {meta.label}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Zap className="h-3 w-3" />
              {tournament.game_name}
            </span>
          </div>

          {tournament.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {tournament.description}
            </p>
          )}

          {/* Participant progress bar */}
          <div className="mt-auto pt-2">
            {fillPct !== null ? (
              <>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {slotsFilled} / {slotsTotal} players
                  </span>
                  <span className={fillPct >= 90 ? 'text-red-500 font-medium' : ''}>{slotsTotal - slotsFilled!} spots left</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${meta?.bar ?? 'bg-brand-500'}`}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Up to {slotsTotal} players
                </span>
                {tournament.starts_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(tournament.starts_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Organizer footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
          <Avatar
            src={organizer?.avatar_url}
            name={organizer?.display_name ?? organizer?.username}
            size="sm"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
            by{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {organizer?.display_name ?? organizer?.username}
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}
