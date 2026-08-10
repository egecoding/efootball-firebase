/**
 * Canonical origin for the site, with no trailing slash.
 *
 * Everything SEO-facing depends on this — metadataBase, every canonical,
 * robots.txt, sitemap.xml and all OG image URLs. A silent localhost fallback
 * in production would poison all of them without failing the build, so
 * production is made to fail loudly instead.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')

  if (process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL must be set in production — canonicals, robots.txt, sitemap.xml and OG URLs all derive from it.'
    )
  }

  // Local dev and CI builds without env vars keep working.
  return 'http://localhost:3000'
}

export const SITE_URL = resolveSiteUrl()
