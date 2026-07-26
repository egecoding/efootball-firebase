'use client'

import { useEffect } from 'react'

interface ViewTrackerProps {
  slug: string
}

/**
 * Fires a view-tracking beacon once per browser tab per post. Blog posts are
 * statically generated, so the page's server component only ever runs at
 * build time — this is the only place a per-visitor signal can come from.
 * Renders nothing.
 */
export function ViewTracker({ slug }: ViewTrackerProps) {
  useEffect(() => {
    const key = `blog_viewed_${slug}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    fetch(`/api/blog/${slug}/view`, { method: 'POST' }).catch(() => {
      // Non-essential — a missed view count isn't worth surfacing to the reader.
    })
  }, [slug])

  return null
}
