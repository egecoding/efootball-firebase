import { cn } from '@/lib/utils/cn'
import type { TournamentStatus, MatchStatus } from '@/types/database'

type BadgeVariant = 'green' | 'yellow' | 'blue' | 'red' | 'gray' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400':
            variant === 'green',
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400':
            variant === 'yellow',
          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400':
            variant === 'blue',
          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400':
            variant === 'red',
          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400':
            variant === 'gray',
          'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400':
            variant === 'purple',
        },
        className
      )}
    >
      {children}
    </span>
  )
}

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const map: Record<TournamentStatus, { label: string; variant: BadgeVariant }> =
    {
      draft: { label: 'Draft', variant: 'gray' },
      open: { label: 'Open', variant: 'green' },
      in_progress: { label: 'In Progress', variant: 'blue' },
      completed: { label: 'Completed', variant: 'purple' },
    }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const map: Record<MatchStatus, { label: string; variant: BadgeVariant }> = {
    pending: { label: 'Pending', variant: 'gray' },
    scheduled: { label: 'Scheduled', variant: 'blue' },
    awaiting_confirmation: { label: 'Awaiting', variant: 'yellow' },
    completed: { label: 'Completed', variant: 'green' },
    walkover: { label: 'Walkover', variant: 'gray' },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export { Badge }
