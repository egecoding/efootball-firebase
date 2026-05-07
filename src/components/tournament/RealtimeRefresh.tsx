'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'

export function RealtimeRefresh({ tournamentId }: { tournamentId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = getClient()
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
        () => { router.refresh() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, router])

  return null
}
