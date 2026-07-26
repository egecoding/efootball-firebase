import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { WHATSAPP_NUMBER } from '@/lib/constants'

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-gray-950 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Col 1 — Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-sm">
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <span className="font-extrabold text-lg text-white">eFootball Cup</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              Free eFootball tournament management. Create brackets, invite players, and track every result — no account needed to join.
            </p>
            <p className="text-xs text-gray-600 mt-6">© {new Date().getFullYear()} eFootball Cup. All rights reserved.</p>
          </div>

          {/* Col 2 — Platform */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Platform</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Home</Link></li>
              <li><Link href="/tournaments" className="hover:text-brand-400 transition-colors">Tournaments</Link></li>
              <li><Link href="/blog" className="hover:text-brand-400 transition-colors">Blog</Link></li>
              <li><Link href="/auth/signup" className="hover:text-brand-400 transition-colors">Create Tournament</Link></li>
              <li><Link href="/auth/login" className="hover:text-brand-400 transition-colors">Sign In</Link></li>
              <li><Link href="/auth/signup" className="hover:text-brand-400 transition-colors">Sign Up</Link></li>
            </ul>
          </div>

          {/* Col 3 — Connect */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Connect</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-brand-400 transition-colors"
                >
                  <span className="text-base">💬</span>
                  Contact via WhatsApp
                </a>
              </li>
              <li>
                <span className="text-gray-600 text-xs">Support available via WhatsApp</span>
              </li>
            </ul>
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-xs text-gray-600">
                Built for the eFootball community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
