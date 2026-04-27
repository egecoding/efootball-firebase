import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcStandings, toDataUri, type MatchRow } from '@/lib/utils/card-helpers'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient()

  const [{ data: tournament }, { data: participants }, { data: rounds }] = await Promise.all([
    admin.from('tournaments').select('id, title, format, starts_at, status').eq('id', params.id).single(),
    admin.from('participants').select('user_id, name, profiles(id, username, display_name, avatar_url)').eq('tournament_id', params.id),
    admin.from('rounds').select('round_number, matches(player1_id, player1_name, player2_id, player2_name, player1_score, player2_score, winner_id, status)').eq('tournament_id', params.id).order('round_number', { ascending: true }),
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

  // Determine winner
  let winnerId: string | null = null
  let winnerName = 'Unknown'
  let winnerAvatar: string | null = null

  const format = (tournament as unknown as { format?: string }).format ?? 'knockout'

  if (format === 'knockout') {
    // Winner = winner_id of the match in the last round
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedRounds = [...(rounds ?? [])].sort((a: any, b: any) => b.round_number - a.round_number)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalRound = sortedRounds[0] as any
    const finalMatch = (finalRound?.matches ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => m.status === 'completed' && m.winner_id
    ) as (MatchRow & { winner_id?: string | null }) | undefined

    if (finalMatch?.winner_id) {
      winnerId = finalMatch.winner_id
      const prof = profileMap.get(winnerId)
      winnerName = prof?.display_name ?? prof?.username ?? 'Champion'
      winnerAvatar = prof?.avatar_url ?? null
    } else if (finalMatch) {
      // Name-only winner
      const p1Score = finalMatch.player1_score ?? 0
      const p2Score = finalMatch.player2_score ?? 0
      winnerName = p1Score > p2Score ? (finalMatch.player1_name ?? 'Champion') : (finalMatch.player2_name ?? 'Champion')
    }
  } else {
    // League / Round robin: top of standings
    const standings = calcStandings(completedMatches, format, profileMap)
    const top = standings[0]
    if (top) {
      winnerId = top.id
      winnerName = top.name
      winnerAvatar = top.avatarUrl
    }
  }

  if (!winnerName || winnerName === 'Unknown') {
    return new Response('Winner not determined yet', { status: 404 })
  }

  // Avatar data URI
  const avatarDataUri = winnerAvatar ? await toDataUri(winnerAvatar) : null

  // Tournament metadata
  const tournamentTitle = tournament.title ?? 'Tournament'
  const dateStr = tournament.starts_at
    ? new Date(tournament.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().getFullYear().toString()
  const playerCount = participants?.length ?? 0
  const formatLabel = format === 'knockout' ? 'Knockout' : format === 'league' ? 'League' : 'Round Robin'

  // Win record
  let winsCount = 0
  if (winnerId) {
    winsCount = completedMatches.filter(
      (m) => (m as unknown as { winner_id?: string | null }).winner_id === winnerId
    ).length
  } else {
    // Name-based winner: count wins by name
    const standings = calcStandings(completedMatches, format, profileMap)
    winsCount = standings[0]?.pts ? Math.floor(standings[0].pts / 3) : 0
  }
  const recordStr = `${winsCount}W`

  // Initial letter for fallback avatar
  const initial = winnerName.charAt(0).toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: 420,
          height: 600,
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Background glow layers */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 80% 60% at 50% 70%, rgba(212,175,55,0.22) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 120% 40% at 50% 100%, rgba(180,120,0,0.28) 0%, transparent 60%)',
          }}
        />

        {/* Confetti dots scattered */}
        {[
          { top: 40, left: 30, color: '#d4af37', size: 4 },
          { top: 60, left: 80, color: '#ffe566', size: 3 },
          { top: 80, left: 160, color: '#fff', size: 2 },
          { top: 50, left: 320, color: '#fbbf24', size: 4 },
          { top: 100, left: 370, color: '#d4af37', size: 3 },
          { top: 120, left: 40, color: '#f59e0b', size: 2 },
          { top: 140, left: 200, color: '#ffe566', size: 3 },
          { top: 30, left: 250, color: '#d4af37', size: 5 },
          { top: 170, left: 390, color: '#fff', size: 2 },
          { top: 20, left: 140, color: '#fcd34d', size: 3 },
          { top: 90, left: 290, color: '#f97316', size: 4 },
          { top: 150, left: 110, color: '#d4af37', size: 2 },
          { top: 500, left: 30, color: '#ffe566', size: 3 },
          { top: 520, left: 380, color: '#d4af37', size: 4 },
          { top: 540, left: 200, color: '#fff', size: 2 },
          { top: 560, left: 100, color: '#fbbf24', size: 3 },
          { top: 480, left: 310, color: '#f59e0b', size: 4 },
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
              transform: `rotate(${i * 37}deg)`,
              opacity: 0.7,
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
                background: 'linear-gradient(135deg, #d4af37, #f5d76e)',
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
                color: '#d4af37',
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
              color: 'rgba(212,175,55,0.5)',
              marginBottom: 14,
            }}
          >
            Tournament
          </span>

          {/* WINNER */}
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              lineHeight: 0.9,
              textTransform: 'uppercase',
              letterSpacing: -3,
              background: 'linear-gradient(180deg, #ffe566 0%, #d4af37 45%, #8b6914 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
              marginBottom: 6,
            }}
          >
            WINNER
          </div>

          {/* Brush stroke */}
          <div
            style={{
              width: 300,
              height: 6,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.8), transparent)',
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
                color: 'rgba(212,175,55,0.7)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span>THE</span><span>UNSTOPPABLE</span><span>FORCE</span>
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                lineHeight: 1.6,
                color: 'rgba(212,175,55,0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <span>VICTORY</span><span>IS</span><span>EARNED</span>
            </div>
          </div>

          {/* Trophy + Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 72, lineHeight: 1, marginBottom: -6 }}>🏆</div>

            {/* Avatar circle */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: avatarDataUri ? 'transparent' : 'linear-gradient(135deg, #1a1a1a, #333)',
                border: '3px solid #d4af37',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: 900,
                color: '#d4af37',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -14,
                  fontSize: 20,
                }}
              >
                👑
              </div>
              {avatarDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarDataUri} alt="" style={{ width: 80, height: 80, objectFit: 'cover' }} />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            {/* Player name */}
            <div
              style={{
                fontSize: winnerName.length > 14 ? 22 : 28,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: -0.5,
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              {winnerName}
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: 'rgba(212,175,55,0.6)',
                marginBottom: 16,
              }}
            >
              Champion · {new Date().getFullYear()}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: '100%',
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
              marginBottom: 14,
            }}
          />

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
              marginBottom: 16,
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#d4af37' }}>{playerCount}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.35)' }}>Players</span>
            </div>
            <div style={{ width: 1, background: 'rgba(212,175,55,0.2)', margin: '4px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#d4af37' }}>⚡</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.35)' }}>{formatLabel}</span>
            </div>
            <div style={{ width: 1, background: 'rgba(212,175,55,0.2)', margin: '4px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#d4af37' }}>{recordStr}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.35)' }}>Record</span>
            </div>
          </div>

          {/* Tournament box */}
          <div
            style={{
              background: 'rgba(212,175,55,0.07)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 8,
              padding: '8px 20px',
              textAlign: 'center',
              marginBottom: 16,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 }}>
              {tournamentTitle}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(212,175,55,0.55)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>
              {dateStr}
            </span>
          </div>

          {/* Bottom */}
          <span
            style={{
              fontSize: 9,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: 'rgba(212,175,55,0.4)',
              marginBottom: 6,
            }}
          >
            Passion · Focus · Victory
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
