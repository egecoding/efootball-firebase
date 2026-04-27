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
  const tournamentTitle = tournament.title ?? 'Tournament'
  const dateStr = tournament.starts_at
    ? new Date(tournament.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().getFullYear().toString()
  const playerCount = participants?.length ?? 0
  const scorerName = topScorer.name
  const goals = topScorer.gf
  const matches = topScorer.mp
  const avgStr = matches > 0 ? (goals / matches).toFixed(1) : '0.0'
  const initial = scorerName.charAt(0).toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: 420,
          height: 600,
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Background glow — orange/red */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 80% 60% at 50% 70%, rgba(249,115,22,0.2) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 120% 40% at 50% 100%, rgba(220,38,38,0.2) 0%, transparent 60%)',
          }}
        />
        {/* Top accent strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308)',
          }}
        />

        {/* Scattered fire/ball confetti */}
        {[
          { top: 40, left: 30, color: '#f97316', size: 4 },
          { top: 70, left: 90, color: '#fbbf24', size: 3 },
          { top: 55, left: 330, color: '#ef4444', size: 5 },
          { top: 30, left: 200, color: '#f97316', size: 3 },
          { top: 100, left: 370, color: '#fbbf24', size: 2 },
          { top: 130, left: 50, color: '#ef4444', size: 3 },
          { top: 160, left: 160, color: '#fbbf24', size: 4 },
          { top: 20, left: 140, color: '#f97316', size: 2 },
          { top: 85, left: 260, color: '#eab308', size: 3 },
          { top: 500, left: 40, color: '#f97316', size: 4 },
          { top: 520, left: 370, color: '#fbbf24', size: 3 },
          { top: 550, left: 180, color: '#ef4444', size: 2 },
          { top: 480, left: 290, color: '#f97316', size: 3 },
        ].map((dot, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: dot.top,
              left: dot.left,
              width: dot.size,
              height: dot.size * 2,
              background: dot.color,
              borderRadius: 1,
              transform: `rotate(${i * 41}deg)`,
              opacity: 0.6,
            }}
          />
        ))}

        {/* Inner content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            padding: '24px 20px 28px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div
              style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              ⚽
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: '#f97316',
              }}
            >
              eFootball Cup
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: 'rgba(249,115,22,0.5)',
              marginBottom: 14,
            }}
          >
            Tournament
          </span>

          {/* TOP SCORER */}
          <div
            style={{
              fontSize: 66,
              fontWeight: 900,
              lineHeight: 0.95,
              textTransform: 'uppercase',
              letterSpacing: -2,
              background: 'linear-gradient(180deg, #fbbf24 0%, #f97316 45%, #ef4444 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
              marginBottom: 2,
            }}
          >
            TOP
          </div>
          <div
            style={{
              fontSize: 66,
              fontWeight: 900,
              lineHeight: 0.95,
              textTransform: 'uppercase',
              letterSpacing: -2,
              background: 'linear-gradient(180deg, #fbbf24 0%, #f97316 45%, #ef4444 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
              marginBottom: 6,
            }}
          >
            SCORER
          </div>

          {/* Brush stroke — orange */}
          <div
            style={{
              width: 300,
              height: 6,
              background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.8), transparent)',
              borderRadius: 4,
              marginBottom: 18,
            }}
          />

          {/* Taglines */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 8px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                lineHeight: 1.6,
                color: 'rgba(249,115,22,0.7)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span>THE</span><span>GOLDEN</span><span>BOOT</span>
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                lineHeight: 1.6,
                color: 'rgba(249,115,22,0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <span>GOALS</span><span>NEVER</span><span>LIE</span>
            </div>
          </div>

          {/* Boot icon + Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 64, lineHeight: 1, marginBottom: -6 }}>👟</div>

            {/* Avatar circle */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: avatarDataUri ? 'transparent' : 'linear-gradient(135deg, #1a0a00, #3d1a00)',
                border: '3px solid #f97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: 900,
                color: '#f97316',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: 10,
              }}
            >
              <div style={{ position: 'absolute', top: -12, fontSize: 18 }}>🔥</div>
              {avatarDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarDataUri} alt="" style={{ width: 80, height: 80, objectFit: 'cover' }} />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            {/* Goals badge */}
            <div
              style={{
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                borderRadius: 20,
                padding: '4px 16px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{goals}</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                goals
              </span>
            </div>

            {/* Player name */}
            <div
              style={{
                fontSize: scorerName.length > 14 ? 22 : 28,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: -0.5,
                textAlign: 'center',
                marginBottom: 3,
              }}
            >
              {scorerName}
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: 'rgba(249,115,22,0.6)',
                marginBottom: 14,
              }}
            >
              Top Scorer · {new Date().getFullYear()}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: '100%',
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.5), transparent)',
              marginBottom: 14,
            }}
          />

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
              marginBottom: 14,
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#f97316' }}>{goals}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.35)' }}>Goals</span>
            </div>
            <div style={{ width: 1, background: 'rgba(249,115,22,0.2)', margin: '4px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#f97316' }}>{matches}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.35)' }}>Matches</span>
            </div>
            <div style={{ width: 1, background: 'rgba(249,115,22,0.2)', margin: '4px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#f97316' }}>{avgStr}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.35)' }}>Avg/Game</span>
            </div>
            <div style={{ width: 1, background: 'rgba(249,115,22,0.2)', margin: '4px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#f97316' }}>{playerCount}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.35)' }}>Players</span>
            </div>
          </div>

          {/* Tournament box */}
          <div
            style={{
              background: 'rgba(249,115,22,0.07)',
              border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: 8,
              padding: '8px 20px',
              textAlign: 'center',
              marginBottom: 14,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 }}>
              {tournamentTitle}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(249,115,22,0.55)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>
              {dateStr}
            </span>
          </div>

          {/* Bottom */}
          <span
            style={{
              fontSize: 9,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: 'rgba(249,115,22,0.4)',
              marginBottom: 6,
            }}
          >
            Skill · Precision · Glory
          </span>
          <span style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.12)', textTransform: 'uppercase' }}>
            efootballcup.vercel.app
          </span>
        </div>
      </div>
    ),
    {
      width: 420,
      height: 600,
    }
  )
}
