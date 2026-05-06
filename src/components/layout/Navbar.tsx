'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Trophy, Sun, Moon, Menu, X, LogOut, User, Shield } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { getClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface NavbarProps {
  user: { id: string } | null
  profile: Profile | null
}

export function Navbar({ user, profile }: NavbarProps) {
  const { theme, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    const supabase = getClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // On the homepage show section anchor links; elsewhere show app links
  const isHome = pathname === '/'
  const navLinks = isHome
    ? [
        { href: '#features', label: 'Features' },
        { href: '#how-it-works', label: 'How it works' },
        { href: '#tournaments', label: 'Tournaments' },
      ]
    : [
        { href: '/tournaments', label: 'Tournaments' },
        ...(user ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
        ...(profile?.is_super_admin ? [{ href: '/admin', label: 'Admin' }] : []),
      ]

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold text-lg shrink-0 group"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-sm group-hover:shadow-brand-500/30 group-hover:shadow-md transition-shadow">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            <span className="hidden sm:inline gradient-text">eFootball Cup</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  !isHome && pathname.startsWith(link.href)
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-white/10'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/10 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Create Tournament CTA — always visible to guests on desktop */}
            {!user && (
              <Link href="/auth/signup" className="hidden md:block">
                <Button size="sm" className="gap-1.5">
                  Create Tournament
                </Button>
              </Link>
            )}

            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/profile" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  <Avatar
                    src={profile?.avatar_url}
                    name={profile?.display_name ?? profile?.username}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {profile?.display_name ?? profile?.username}
                  </span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-4 flex flex-col gap-3 animate-slide-up">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 py-1"
            >
              {link.label}
            </a>
          ))}
          {user ? (
            <>
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 py-1"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              {profile?.is_super_admin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 text-sm font-medium text-brand-400 py-1"
                >
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 py-1"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <div className="flex gap-2 pt-1">
              <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="flex-1">
                <Button variant="secondary" size="sm" className="w-full">
                  Sign in
                </Button>
              </Link>
              <Link href="/auth/signup" onClick={() => setMenuOpen(false)} className="flex-1">
                <Button size="sm" className="w-full">
                  Sign up
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
