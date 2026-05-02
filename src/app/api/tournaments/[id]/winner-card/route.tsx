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
      const p1Score = finalMatch.player1_score ?? 0
      const p2Score = finalMatch.player2_score ?? 0
      winnerName = p1Score > p2Score ? (finalMatch.player1_name ?? 'Champion') : (finalMatch.player2_name ?? 'Champion')
    }
  } else {
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

  const avatarDataUri = winnerAvatar ? await toDataUri(winnerAvatar) : null

  const tournamentTitle = (tournament.title ?? 'Tournament').toUpperCase()
  const dateStr = tournament.starts_at
    ? new Date(tournament.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().getFullYear().toString()
  const playerCount = participants?.length ?? 0
  const formatLabel = format === 'knockout' ? 'Knockout' : format === 'league' ? 'League' : format === 'champions_league' ? 'Champions League' : 'Round Robin'

  let winsCount = 0
  if (winnerId) {
    winsCount = completedMatches.filter(
      (m) => (m as unknown as { winner_id?: string | null }).winner_id === winnerId
    ).length
  } else {
    const standings = calcStandings(completedMatches, format, profileMap)
    winsCount = standings[0]?.pts ? Math.floor(standings[0].pts / 3) : 0
  }

  const displayName = winnerName.toUpperCase()
  const displayNameTrunc = displayName.length > 16 ? displayName.slice(0, 15) + '…' : displayName
  const nameFontSize = displayName.length > 12 ? 22 : 30
  const initial = winnerName.charAt(0).toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: 420,
          height: 600,
          background: '#0e0900',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Background gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1a1000 0%, #0e0900 50%, #070500 100%)' }} />

        {/* Central spotlight */}
        <div
          style={{
            position: 'absolute',
            top: 140,
            left: '50%',
            width: 380,
            height: 380,
            marginLeft: -190,
            background: 'radial-gradient(circle, rgba(212,175,55,0.22) 0%, rgba(180,130,0,0.1) 45%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            width: 320,
            height: 200,
            marginLeft: -160,
            background: 'radial-gradient(ellipse, rgba(255,220,80,0.08) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #92400e, #d4af37, #f5d76e, #d4af37, #92400e)' }} />

        {/* Side accent lines */}
        <div style={{ position: 'absolute', top: 3, left: 0, width: 3, height: 597, background: 'linear-gradient(180deg, #d4af37 0%, rgba(212,175,55,0.05) 100%)' }} />
        <div style={{ position: 'absolute', top: 3, right: 0, width: 3, height: 597, background: 'linear-gradient(180deg, #d4af37 0%, rgba(212,175,55,0.05) 100%)' }} />

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
            <div style={{ width: 20, height: 20, borderRadius: 4, background: 'linear-gradient(135deg, #92400e, #d4af37)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>⚽</div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(245,215,110,0.7)' }}>eFootball Cup</span>
          </div>

          {/* TOURNAMENT CHAMPION headline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 4 }}>
            <span
              style={{
                fontSize: 38,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: 6,
                textTransform: 'uppercase',
                color: 'rgba(245,215,110,0.6)',
                textAlign: 'center',
              }}
            >
              TOURNAMENT
            </span>
            <span
              style={{
                fontSize: 90,
                fontWeight: 900,
                lineHeight: 0.88,
                letterSpacing: -3,
                textTransform: 'uppercase',
                background: 'linear-gradient(180deg, #f5d76e 0%, #d4af37 40%, #8b6914 100%)',
                backgroundClip: 'text',
                color: 'transparent',
                textAlign: 'center',
              }}
            >
              WINNER
            </span>
          </div>

          {/* Gold accent rule */}
          <div style={{ width: 260, height: 2, background: 'linear-gradient(90deg, transparent, #d4af37, transparent)', borderRadius: 2, marginBottom: 16 }} />

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
                border: '2px solid rgba(212,175,55,0.4)',
                boxShadow: '0 0 40px rgba(212,175,55,0.25)',
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
                border: '2px solid rgba(245,215,110,0.6)',
              }}
            />
            {/* Avatar circle */}
            <div
              style={{
                width: 164,
                height: 164,
                borderRadius: '50%',
                background: avatarDataUri ? 'transparent' : 'linear-gradient(135deg, #3d2900, #1a1000)',
                border: '3px solid #d4af37',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 52,
                fontWeight: 900,
                color: '#d4af37',
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
              letterSpacing: 2,
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            {displayNameTrunc}
          </div>

          {/* Champion label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 40, height: 1, background: 'rgba(212,175,55,0.5)' }} />
            <span style={{ fontSize: 11, color: 'rgba(245,215,110,0.7)', letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>CHAMPION</span>
            <div style={{ width: 40, height: 1, background: 'rgba(212,175,55,0.5)' }} />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 14, width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#d4af37' }}>{playerCount}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.3)' }}>Players</span>
            </div>
            <div style={{ width: 1, background: 'rgba(212,175,55,0.2)', margin: '4px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#d4af37' }}>{winsCount}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.3)' }}>Wins</span>
            </div>
            <div style={{ width: 1, background: 'rgba(212,175,55,0.2)', margin: '4px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#d4af37', letterSpacing: 1 }}>{formatLabel.toUpperCase()}</span>
              <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.3)' }}>Format</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '88%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)', marginBottom: 12 }} />

          {/* Tournament name box */}
          <div
            style={{
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.22)',
              borderRadius: 6,
              padding: '7px 20px',
              textAlign: 'center',
              marginBottom: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.82)', letterSpacing: 1 }}>
              {tournamentTitle}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(245,215,110,0.45)', letterSpacing: 2, marginTop: 2, textTransform: 'uppercase' }}>
              {dateStr}
            </span>
          </div>

          {/* Bottom tagline */}
          <span style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(212,175,55,0.2)' }}>
            efootballcup.vercel.app
          </span>
        </div>

        {/* Trophy badge — bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: 0.75,
          }}
        >
          <span style={{ fontSize: 32 }}>🏆</span>
        </div>

        {/* Crown badge — bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: 0.6,
          }}
        >
          <span style={{ fontSize: 26 }}>👑</span>
        </div>
      </div>
    ),
    {
      width: 420,
      height: 600,
    }
  )
}
