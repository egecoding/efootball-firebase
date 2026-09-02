import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import { JsonLd } from '@/components/seo/JsonLd'
import { organizationSchema, webSiteSchema, softwareApplicationSchema } from '@/lib/seo'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppButton } from '@/components/layout/WhatsAppButton'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { PushPrompt } from '@/components/layout/PushPrompt'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/site'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

// NOTE: deliberately no `alternates.canonical` here. Next inherits metadata
// into every child route that does not override it, so a canonical set on the
// root layout would point the entire site at "/". Canonicals are per-page.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'eFootball Cup — Free Tournament Manager',
    template: '%s — eFootball Cup',
  },
  description:
    'Create and manage eFootball tournaments. Generate brackets, track matches, and compete with players worldwide.',
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    title: 'eFootball Cup — Free Tournament Manager',
    description:
      'Create and manage eFootball tournaments. Generate brackets, track matches, and compete with players worldwide. Free forever.',
    type: 'website',
    siteName: 'eFootball Cup',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'eFootball Cup — Free Tournament Manager',
    description: 'Create and manage eFootball tournaments. Free forever.',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'eFCup',
  },
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

// Keep in sync with `theme_color` in public/manifest.json.
export const viewport: Viewport = {
  themeColor: '#22c55e',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, wins, losses, is_super_admin, created_at, updated_at')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={webSiteSchema()} />
        <JsonLd data={softwareApplicationSchema()} />
        <ThemeProvider>
          <Navbar user={user} profile={profile} />
          <main>{children}</main>
          <Footer />
          <WhatsAppButton />
          <InstallPrompt />
          <PushPrompt enabled={!!user} />
        </ThemeProvider>
        <Analytics />
        <GoogleAnalytics />
      </body>
    </html>
  )
}
