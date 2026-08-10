import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/**
 * Only genuinely private, redirect-guarded areas are disallowed here.
 *
 * Thin-but-public pages (/auth/*, /profile/*, /matches/*, /share, …) are
 * handled with `robots: NOINDEX` metadata instead — a Disallow stops Google
 * fetching the page at all, so it would never see the noindex directive and
 * could still index the bare URL from inbound links. Never combine the two.
 */
export default function robots(): MetadataRoute.Robots {
  // Vercel already sends X-Robots-Tag: noindex on preview URLs; this is belt-and-braces.
  if (process.env.VERCEL_ENV === 'preview') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
