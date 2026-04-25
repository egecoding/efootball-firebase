import Link from 'next/link'
import { Users, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import type { TournamentWithOrganizer } from '@/types/database'

interface TournamentCardProps {
  tournament: TournamentWithOrganizer
  participantCount?: number
}

const FORMAT_META: Record<string, { emoji: string; label: string; color: string }> = {
  knockout:    { emoji: '⚡', label: 'Knockout',    color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
  round_robin: { emoji: '🔄', label: 'Round Robin', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  league:      { emoji: '📋', label: 'League',      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
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
    <Link href={`/tournaments/${tournament.id}`}>
      <Card hover className="h-full flex flex-col group">
        <CardContent className="flex flex-col gap-3 pt-5 flex-1">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 flex-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {tournament.title}
            </h3>
            <TournamentStatusBadge status={tournament.status} />
          </div>

          {/* Format badge */}
          {meta && (
            <span className={`self-start inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
              {meta.emoji} {meta.label}
            </span>
          )}

          {tournament.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {tournament.description}
            </p>
          )}

          {/* Participant progress bar (when count is known) */}
          {fillPct !== null ? (
            <div className="mt-auto pt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {slotsFilled} / {slotsTotal}
                </span>
                <span>{slotsTotal - slotsFilled!} left</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-auto pt-2">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                up to {slotsTotal}
              </span>
              {tournament.starts_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(tournament.starts_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {/* Organizer */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
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
        </CardContent>
      </Card>
    </Link>
  )
}
