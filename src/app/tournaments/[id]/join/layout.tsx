import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/seo'

// Pass-through layout — page.tsx is a client component and cannot export metadata.
export const metadata: Metadata = {
  title: 'Join Tournament',
  robots: NOINDEX,
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
