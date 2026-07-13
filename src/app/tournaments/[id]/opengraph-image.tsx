import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'eFootball Cup tournament'

const FORMAT_LABELS: Record<string, string> = {
  knockout: 'Knockout',
  double_elimination: 'Double Elimination',
  home_away_knockout: 'Home & Away Knockout',
  group_knockout: 'Group Stage + Knockout',
  champions_league: 'Champions League',
  league: 'League',
  round_robin: 'Round Robin',
  swiss: 'Swiss',
}

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  in_progress: 'Live Now',
  completed: 'Completed',
}

export default async function Image({ params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const [{ data: tournament }, { count: participantCount }] = await Promise.all([
    admin.from('tournaments').select('title, game_name, format, status, max_participants').eq('id', params.id).single(),
    admin.from('participants').select('id', { count: 'exact', head: true }).eq('tournament_id', params.id),
  ])

  const title = tournament?.title ?? 'eFootball Tournament'
  const formatLabel = FORMAT_LABELS[tournament?.format ?? ''] ?? 'Tournament'
  const statusLabel = STATUS_LABELS[tournament?.status ?? ''] ?? 'Upcoming'
  const gameName = tournament?.game_name ?? 'eFootball'
  const playerCount = participantCount ?? 0
  const maxParticipants = tournament?.max_participants ?? 0

  const displayTitle = title.length > 42 ? title.slice(0, 41) + '…' : title
  const titleFontSize = displayTitle.length > 28 ? 56 : 72

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #0b1610 0%, #09090b 55%, #050505 100%)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          position: 'relative',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -80,
            width: 500,
            height: 500,
            background: 'radial-gradient(circle, rgba(34,197,94,0.28) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #15803d, #22c55e, #4ade80, #22c55e, #15803d)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '64px 80px', position: 'relative' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #4ade80, #16a34a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              🏆
            </div>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#ffffff' }}>eFootball Cup</span>
          </div>

          {/* Status badge */}
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 999,
              background: tournament?.status === 'in_progress' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${tournament?.status === 'in_progress' ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.15)'}`,
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700, color: tournament?.status === 'in_progress' ? '#4ade80' : '#d1d5db', textTransform: 'uppercase', letterSpacing: 1 }}>
              {statusLabel}
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: titleFontSize,
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.1,
              marginBottom: 24,
              maxWidth: 980,
            }}
          >
            {displayTitle}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 24, color: '#9ca3af' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚽</span>
              <span>{gameName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🎮</span>
              <span>{formatLabel}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>👥</span>
              <span>
                {playerCount}
                {maxParticipants ? ` / ${maxParticipants}` : ''} players
              </span>
            </div>
          </div>
        </div>

        {/* Footer strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 80px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: 18,
            color: '#6b7280',
          }}
        >
          <span>Free to play · Free to host</span>
          <span>efootballcup</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
