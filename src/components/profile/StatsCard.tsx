import { Trophy, XCircle } from 'lucide-react'
import type { Profile } from '@/types/database'

interface StatsCardProps {
  profile: Profile
}

export function StatsCard({ profile }: StatsCardProps) {
  const total = profile.wins + profile.losses
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Statistics
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Trophy className="h-4 w-4 text-brand-500" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.wins}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Wins</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.losses}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Losses</p>
        </div>
        <div className="text-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {winRate}%
          </span>
          <p className="text-xs text-gray-400 dark:text-gray-500">Win Rate</p>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
