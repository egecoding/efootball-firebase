import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/seo'

/**
 * Pass-through layout that exists only to apply noindex to all four /auth
 * pages at once (two of them are client components and cannot export
 * metadata themselves).
 *
 * These are crawlable on purpose — /auth/signup is the primary CTA linked
 * from the hero, CTA banner and footer, so robots.ts must NOT disallow it or
 * Google would never fetch the page and see this directive.
 */
export const metadata: Metadata = {
  robots: NOINDEX,
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
