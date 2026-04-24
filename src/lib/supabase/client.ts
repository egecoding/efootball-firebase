'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

let _client: ReturnType<typeof createClient> | undefined

export function getClient(): ReturnType<typeof createClient> {
  if (!_client) _client = createClient()
  return _client
}
