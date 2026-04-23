import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Navbar } from '@/components/layout/Navbar'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'eFootball Cup — Tournament Manager',
  description:
    'Create and manage eFootball tournaments. Generate brackets, track matches, and compete with players worldwide.',
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Navbar user={user} profile={profile} />
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
