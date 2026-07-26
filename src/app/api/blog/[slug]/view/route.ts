import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllPosts } from '@/lib/blog'

// POST /api/blog/[slug]/view
// Records one page view. Public, unauthenticated (it's a blog) — but only for
// a slug that actually corresponds to a real post, so this can't be used to
// stuff arbitrary rows into the table.
export async function POST(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const exists = getAllPosts().some((p) => p.slug === params.slug)
  if (!exists) {
    return NextResponse.json({ error: 'Unknown post' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('blog_post_views').insert({ slug: params.slug })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
