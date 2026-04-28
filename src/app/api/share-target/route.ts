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

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const mimeType = allowedTypes.includes(file.type) ? file.type : 'image/jpeg'
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
