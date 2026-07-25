import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

// POST /api/share-target
// Receives a shared image from the Android share sheet (via PWA share_target manifest entry).
// Uploads the image to Supabase Storage under a temp path, then redirects to /share?key=...
export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.redirect(new URL('/share?error=nofile', req.url))
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.redirect(new URL('/share?error=nofile', req.url))
  }

  // This endpoint can't require a session: it's POSTed by the OS share sheet, and
  // guests authenticate with a localStorage id the share sheet can't send. So the
  // upload stays open — but bound it tightly to real, small images to limit abuse.
  const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.redirect(new URL('/share?error=filetype', req.url))
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.redirect(new URL('/share?error=toolarge', req.url))
  }

  const mimeType = file.type
  const ext = mimeType.split('/')[1]
  const key = randomUUID()
  const path = `share-temp/${key}.${ext}`

  const admin = createAdminClient()
  const bytes = await file.arrayBuffer()

  const { error } = await admin.storage
    .from('screenshots')
    .upload(path, bytes, { upsert: false, contentType: mimeType })

  if (error) {
    return NextResponse.redirect(new URL('/share?error=upload', req.url))
  }

  // Redirect to the /share page with the temp key so the client can load and submit it
  return NextResponse.redirect(new URL(`/share?key=${key}`, req.url))
}
