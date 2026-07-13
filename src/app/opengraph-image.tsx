import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'eFootball Cup — free eFootball tournament manager'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #0b1610 0%, #09090b 55%, #050505 100%)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -140,
            left: -100,
            width: 560,
            height: 560,
            background: 'radial-gradient(circle, rgba(34,197,94,0.3) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #15803d, #22c55e, #4ade80, #22c55e, #15803d)' }} />

        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            background: 'linear-gradient(135deg, #4ade80, #16a34a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 64,
            marginBottom: 32,
            boxShadow: '0 0 60px rgba(34,197,94,0.4)',
          }}
        >
          🏆
        </div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 900, color: '#ffffff', marginBottom: 16 }}>eFootball Cup</div>
        <div style={{ display: 'flex', fontSize: 32, color: '#9ca3af' }}>Create tournaments · Track matches · Free forever</div>
      </div>
    ),
    { ...size }
  )
}
