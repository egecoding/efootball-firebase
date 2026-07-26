import { ImageResponse } from 'next/og'
import { getPostBySlug } from '@/lib/blog'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'eFootball Cup blog post'

export default async function Image({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug)
  const title = post?.title ?? 'eFootball Cup Blog'

  const displayTitle = title.length > 70 ? title.slice(0, 69) + '…' : title
  const titleFontSize = displayTitle.length > 44 ? 52 : 64

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
              📝
            </div>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#ffffff' }}>eFootball Cup Blog</span>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: titleFontSize,
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.15,
              maxWidth: 1000,
            }}
          >
            {displayTitle}
          </div>
        </div>

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
