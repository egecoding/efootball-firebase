import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcTopScorer, toDataUri, type MatchRow } from '@/lib/utils/card-helpers'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient()

  const [{ data: tournament }, { data: participants }, { data: rounds }] = await Promise.all([
    admin.from('tournaments').select('id, title, format, starts_at').eq('id', params.id).single(),
    admin.from('participants').select('user_id, name, profiles(id, username, display_name, avatar_url)').eq('tournament_id', params.id),
    admin.from('rounds').select('matches(player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, status)').eq('tournament_id', params.id),
  ])

  if (!tournament) {
    return new Response('Tournament not found', { status: 404 })
  }

  // Build profile map
  const profileMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>()
  for (const p of participants ?? []) {
    if (p.user_id && p.profiles) {
      const prof = p.profiles as unknown as { username: string | null; display_name: string | null; avatar_url: string | null }
      profileMap.set(p.user_id, { display_name: prof.display_name, username: prof.username, avatar_url: prof.avatar_url })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allMatches: MatchRow[] = (rounds ?? []).flatMap((r: any) => r.matches ?? [])
  const completedMatches = allMatches.filter((m) => (m as unknown as { status: string }).status === 'completed')

  const topScorer = calcTopScorer(completedMatches, profileMap)
  if (!topScorer || topScorer.gf === 0) {
    return new Response('No scorer data yet', { status: 404 })
  }

  const avatarDataUri = topScorer.avatarUrl ? await toDataUri(topScorer.avatarUrl) : null
  const tournamentTitle = (tournament.title ?? 'Tournament').toUpperCase()
  const dateStr = tournament.starts_at
    ? new Date(tournament.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().getFullYear().toString()
  const scorerName = topScorer.name.toUpperCase()
  const goals = topScorer.gf
  const matches = topScorer.mp
  const avgStr = matches > 0 ? (goals / matches).toFixed(1) : '0.0'
  const initial = topScorer.name.charAt(0).toUpperCase()

  // Truncate long name
  const displayName = scorerName.length > 16 ? scorerName.slice(0, 15) + '…' : scorerName
  const nameFontSize = scorerName.length > 12 ? 22 : 28

  return new ImageResponse(
    (
      <div
        style={{
          width: 420,
          height: 600,
          background: '#080f1e',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Deep background gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #0d1a3a 0%, #080f1e 50%, #0a0d15 100%)' }} />

        {/* Central spotlight behind avatar */}
        <div
          style={{
            position: 'absolute',
            top: 160,
            left: '50%',
            width: 360,
            height: 360,
            marginLeft: -180,
            background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, rgba(99,102,241,0.12) 40%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 220,
            left: '50%',
            width: 280,
            height: 280,
            marginLeft: -140,
            background: 'radial-gradient(circle, rgba(234,179,8,0.1) 0%, transparent 60%)',
            borderRadius: '50%',
          }}
        />

        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #1d4ed8, #eab308, #1d4ed8)' }} />

        {/* Side accent lines */}
        <div style={{ position: 'absolute', top: 3, left: 0, width: 3, height: 597, background: 'linear-gradient(180deg, #1d4ed8 0%, rgba(29,78,216,0.1) 100%)' }} />
        <div style={{ position: 'absolute', top: 3, right: 0, width: 3, height: 597, background: 'linear-gradient(180deg, #eab308 0%, rgba(234,179,8,0.1) 100%)' }} />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            padding: '20px 24px 20px',
          }}
        >
          {/* Org label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>⚽</div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(147,197,253,0.7)' }}>eFootball Cup</span>
          </div>

          {/* TOP SCORER headline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 4 }}>
            <span
              style={{
                fontSize: 82,
                fontWeight: 900,
                lineHeight: 0.92,
                letterSpacing: -2,
                textTransform: 'uppercase',
                color: '#ffffff',
                textAlign: 'center',
              }}
            >
              TOP
            </span>
            <span
              style={{
                fontSize: 82,
                fontWeight: 900,
                lineHeight: 0.92,
                letterSpacing: -2,
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #fbbf24 0%, #eab308 50%, #d97706 100%)',
                backgroundClip: 'text',
                color: 'transparent',
                textAlign: 'center',
              }}
            >
              SCORER
            </span>
          </div>

          {/* Gold accent rule */}
          <div style={{ width: 220, height: 2, background: 'linear-gradient(90deg, transparent, #eab308, transparent)', borderRadius: 2, marginBottom: 16 }} />

          {/* Avatar — large focal point */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            {/* Outer glow ring */}
            <div
              style={{
                position: 'absolute',
                width: 196,
                height: 196,
                borderRadius: '50%',
                background: 'transparent',
                border: '2px solid rgba(234,179,8,0.35)',
                boxShadow: '0 0 32px rgba(234,179,8,0.2)',
              }}
            />
            {/* Inner ring */}
            <div
              style={{
                position: 'absolute',
                width: 178,
                height: 178,
                borderRadius: '50%',
                background: 'transparent',
                border: '2px solid rgba(59,130,246,0.5)',
              }}
            />
            {/* Avatar circle */}
            <div
              style={{
                width: 164,
                height: 164,
                borderRadius: '50%',
                background: avatarDataUri ? 'transparent' : 'linear-gradient(135deg, #1e3a5f, #0d1a3a)',
                border: '3px solid #eab308',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 52,
                fontWeight: 900,
                color: '#eab308',
                overflow: 'hidden',
              }}
            >
              {avatarDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarDataUri} alt="" style={{ width: 164, height: 164, objectFit: 'cover' }} />
              ) : (
                <span>{initial}</span>
              )}
            </div>
          </div>

          {/* Player name */}
          <div
            style={{
              fontSize: nameFontSize,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: 1,
              textAlign: 'center',
              marginBottom: 2,
            }}
          >
            {displayName}
          </div>

          {/* Goals headline — "N GOALS" style */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1,
                background: 'linear-gradient(180deg, #fbbf24 0%, #eab308 60%, #d97706 100%)',
                backgroundClip: 'text',
                color: 'transparent',
                letterSpacing: -2,
              }}
            >
              {goals}
            </span>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              GOALS
            </span>
          </div>

          {/* Avg per game */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 10, color: 'rgba(147,197,253,0.55)', letterSpacing: 2, textTransform: 'uppercase' }}>
              {matches} matches
            </span>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(234,179,8,0.5)' }} />
            <span style={{ fontSize: 10, color: 'rgba(147,197,253,0.55)', letterSpacing: 2, textTransform: 'uppercase' }}>
              {avgStr} avg
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: '88%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.4), rgba(234,179,8,0.4), transparent)', marginBottom: 12 }} />

          {/* Tournament name box */}
          <div
            style={{
              background: 'rgba(29,78,216,0.12)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 6,
              padding: '6px 20px',
              textAlign: 'center',
              marginBottom: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: 1 }}>
              {tournamentTitle}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(147,197,253,0.45)', letterSpacing: 2, marginTop: 2, textTransform: 'uppercase' }}>
              {dateStr}
            </span>
          </div>

          {/* Bottom tagline */}
          <span style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(147,197,253,0.25)' }}>
            efootballcup.vercel.app
          </span>
        </div>

        {/* Boot badge — bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: 0.7,
          }}
        >
          <span style={{ fontSize: 28 }}>👟</span>
          <span style={{ fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(234,179,8,0.6)', marginTop: 2 }}>Golden Boot</span>
        </div>
      </div>
    ),
    {
      width: 420,
      height: 600,
    }
  )
}
