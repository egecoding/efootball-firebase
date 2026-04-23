'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any

export function getClient() {
  if (!_client) _client = createClient()
  return _client
}
