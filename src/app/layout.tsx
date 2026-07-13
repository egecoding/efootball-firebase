import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppButton } from '@/components/layout/WhatsAppButton'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { PushPrompt } from '@/components/layout/PushPrompt'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/site'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'eFootball Cup — Tournament Manager',
  description:
    'Create and manage eFootball tournaments. Generate brackets, track matches, and compete with players worldwide.',
  openGraph: {
    title: 'eFootball Cup — Tournament Manager',
    description:
      'Create and manage eFootball tournaments. Generate brackets, track matches, and compete with players worldwide. Free forever.',
    type: 'website',
    siteName: 'eFootball Cup',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'eFootball Cup — Tournament Manager',
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
      <head>
        <meta name="theme-color" content="#22c55e" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <ThemeProvider>
          <Navbar user={user} profile={profile} />
          <main>{children}</main>
          <Footer />
          <WhatsAppButton />
          <InstallPrompt />
          <PushPrompt />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
