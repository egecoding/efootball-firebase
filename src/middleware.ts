import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = ['/dashboard', '/tournaments/new']
const PROFILE_PREFIX = '/profile'
const AUTH_ROUTES = ['/auth/login', '/auth/signup']

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected routes
  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    (pathname.startsWith(PROFILE_PREFIX) && pathname === '/profile')

  if (isProtected && !user) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p))
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
