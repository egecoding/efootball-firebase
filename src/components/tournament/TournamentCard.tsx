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

export function TournamentCard({ tournament, participantCount }: TournamentCardProps) {
  const organizer = tournament.profiles

  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <Card hover className="h-full flex flex-col">
        <CardContent className="flex flex-col gap-3 pt-5 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 flex-1">
              {tournament.title}
            </h3>
            <TournamentStatusBadge status={tournament.status} />
          </div>

          {tournament.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {tournament.description}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-auto pt-2">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {participantCount !== undefined
                ? `${participantCount} / ${tournament.max_participants}`
                : `up to ${tournament.max_participants}`}
            </span>
            {tournament.starts_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(tournament.starts_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Avatar
              src={organizer?.avatar_url}
              name={organizer?.display_name ?? organizer?.username}
              size="sm"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
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
