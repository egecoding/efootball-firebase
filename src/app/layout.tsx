import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Navbar } from '@/components/layout/Navbar'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { PushPrompt } from '@/components/layout/PushPrompt'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'eFootball Cup — Tournament Manager',
  description:
    'Create and manage eFootball tournaments. Generate brackets, track matches, and compete with players worldwide.',
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
      .select('id, username, display_name, avatar_url, wins, losses, created_at, updated_at')
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
          <InstallPrompt />
          <PushPrompt />
        </ThemeProvider>
      </body>
    </html>
  )
}
