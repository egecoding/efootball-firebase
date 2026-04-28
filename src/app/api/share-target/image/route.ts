import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/share-target/image?key=uuid
// Returns a short-lived signed URL for a temp shared image
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key || !/^[0-9a-f-]{36}$/.test(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Try common extensions
  for (const ext of ['jpeg', 'png', 'webp', 'jpg']) {
    const path = `share-temp/${key}.${ext}`
    const { data } = await admin.storage.from('screenshots').createSignedUrl(path, 3600)
    if (data?.signedUrl) {
      return NextResponse.json({ url: data.signedUrl })
    }
  }

  return NextResponse.json({ error: 'Image not found' }, { status: 404 })
}
