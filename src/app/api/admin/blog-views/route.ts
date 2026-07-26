import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllPosts } from '@/lib/blog'

export const dynamic = 'force-dynamic'

const CHART_DAYS = 30

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

function lastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function bucketByDay(timestamps: string[], days: string[]): number[] {
  const counts = new Map(days.map((d) => [d, 0]))
  for (const ts of timestamps) {
    const k = dayKey(ts)
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return days.map((d) => counts.get(d) ?? 0)
}

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString()
}

export async function GET() {
  const admin_user = await requireSuperAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()

  const [
    { count: total },
    { count: today },
    { count: thisWeek },
    { count: thisMonth },
    { data: recentViews },
    { data: allViews },
  ] = await Promise.all([
    db.from('blog_post_views').select('*', { count: 'exact', head: true }),
    db.from('blog_post_views').select('*', { count: 'exact', head: true }).gte('viewed_at', isoDaysAgo(0).slice(0, 10)),
    db.from('blog_post_views').select('*', { count: 'exact', head: true }).gte('viewed_at', isoDaysAgo(7)),
    db.from('blog_post_views').select('*', { count: 'exact', head: true }).gte('viewed_at', isoDaysAgo(30)),
    db.from('blog_post_views').select('viewed_at').gte('viewed_at', isoDaysAgo(CHART_DAYS)),
    db.from('blog_post_views').select('slug'),
  ])

  const days = lastNDays(CHART_DAYS)

  // Per-post breakdown, joined with post titles (posts are files, not a DB table).
  const postBySlug = new Map(getAllPosts().map((p) => [p.slug, p.title]))
  const viewsBySlug = new Map<string, number>()
  for (const row of allViews ?? []) {
    viewsBySlug.set(row.slug, (viewsBySlug.get(row.slug) ?? 0) + 1)
  }
  const byPost = Array.from(viewsBySlug.entries())
    .map(([slug, views]) => ({ slug, title: postBySlug.get(slug) ?? slug, views }))
    .sort((a, b) => b.views - a.views)

  return NextResponse.json({
    total: total ?? 0,
    today: today ?? 0,
    thisWeek: thisWeek ?? 0,
    thisMonth: thisMonth ?? 0,
    days,
    dailyViews: bucketByDay((recentViews ?? []).map((r) => r.viewed_at as string), days),
    byPost,
  })
}
