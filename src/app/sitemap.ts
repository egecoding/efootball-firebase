import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/site'
import { getAllPosts } from '@/lib/blog'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/tournaments`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.7 },
  ]

  const blogRoutes: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const admin = createAdminClient()
  const { data: tournaments } = await admin
    .from('tournaments')
    .select('id, updated_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(1000)

  const tournamentRoutes: MetadataRoute.Sitemap = (tournaments ?? []).map((t) => ({
    url: `${SITE_URL}/tournaments/${t.id}`,
    lastModified: t.updated_at ?? undefined,
    changeFrequency: 'hourly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes, ...tournamentRoutes]
}
