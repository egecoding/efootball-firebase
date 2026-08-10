import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/site'
import { getAllPosts } from '@/lib/blog'

/**
 * Google's per-sitemap cap is 50,000 URLs. This limit is well under it so the
 * request stays fast — raise it, or split into a sitemap index, before the
 * public tournament count gets close, otherwise tournaments silently drop out
 * of the sitemap with no error.
 */
const TOURNAMENT_LIMIT = 5000

// Only indexable routes belong here. Anything carrying `robots: NOINDEX`
// (/auth/*, /profile/*, /matches/*, /share, /offline, tournament sub-pages)
// must stay out — a noindexed URL in a sitemap is a contradictory signal.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = getAllPosts()

  const admin = createAdminClient()
  const { data: tournaments } = await admin
    .from('tournaments')
    .select('id, updated_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(TOURNAMENT_LIMIT)

  // Derive lastModified from real content changes rather than the current
  // time — a timestamp that moves on every crawl is a signal Google discounts.
  const newestPost = posts[0]?.date
  const newestTournament = (tournaments ?? [])
    .map((t) => t.updated_at)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1)

  const newestOverall =
    [newestPost, newestTournament].filter(Boolean).sort().at(-1) ?? undefined

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: newestOverall, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/tournaments`, lastModified: newestTournament, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/leaderboard`, lastModified: newestTournament, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/blog`, lastModified: newestPost, changeFrequency: 'weekly', priority: 0.7 },
  ]

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.updated ?? post.date,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const tournamentRoutes: MetadataRoute.Sitemap = (tournaments ?? []).map((t) => ({
    url: `${SITE_URL}/tournaments/${t.id}`,
    lastModified: t.updated_at ?? undefined,
    changeFrequency: 'hourly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes, ...tournamentRoutes]
}
