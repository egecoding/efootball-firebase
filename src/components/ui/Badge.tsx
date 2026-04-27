import { cn } from '@/lib/utils/cn'
import type { TournamentStatus, MatchStatus } from '@/types/database'

type BadgeVariant = 'green' | 'yellow' | 'blue' | 'red' | 'gray' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  dot?: boolean
  className?: string
}

function Badge({ children, variant = 'gray', dot = false, className }: BadgeProps) {
  const dotColor: Record<BadgeVariant, string> = {
    green:  'bg-green-500',
    yellow: 'bg-yellow-500',
    blue:   'bg-blue-500',
    red:    'bg-red-500',
    gray:   'bg-gray-400',
    purple: 'bg-purple-500',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide',
        {
          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800/60':
            variant === 'green',
          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 ring-1 ring-yellow-200 dark:ring-yellow-800/60':
            variant === 'yellow',
          'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800/60':
            variant === 'blue',
          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/60':
            variant === 'red',
          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700':
            variant === 'gray',
          'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-800/60':
            variant === 'purple',
        },
        className
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor[variant])} />
      )}
      {children}
    </span>
  )
}

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const map: Record<TournamentStatus, { label: string; variant: BadgeVariant; dot: boolean }> = {
    draft:       { label: 'Draft',       variant: 'gray',   dot: false },
    open:        { label: 'Open',        variant: 'green',  dot: true  },
    in_progress: { label: 'In Progress', variant: 'blue',   dot: true  },
    completed:   { label: 'Completed',   variant: 'purple', dot: false },
  }
  const { label, variant, dot } = map[status]
  return <Badge variant={variant} dot={dot}>{label}</Badge>
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const map: Record<MatchStatus, { label: string; variant: BadgeVariant; dot: boolean }> = {
    pending:               { label: 'Pending',   variant: 'gray',   dot: false },
    scheduled:             { label: 'Scheduled', variant: 'blue',   dot: false },
    awaiting_confirmation: { label: 'Awaiting',  variant: 'yellow', dot: true  },
    completed:             { label: 'Done',       variant: 'green',  dot: false },
    walkover:              { label: 'Walkover',   variant: 'gray',   dot: false },
  }
  const { label, variant, dot } = map[status]
  return <Badge variant={variant} dot={dot}>{label}</Badge>
}

export { Badge }
