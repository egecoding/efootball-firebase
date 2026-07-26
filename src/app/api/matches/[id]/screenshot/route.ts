import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { authorizeMatchActor } from '@/lib/match-auth'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const auth = await authorizeMatchActor(
    admin,
    params.id,
    user,
    request.headers.get('X-Participant-Id')
  )
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const uploaderSlug = auth.actor.slug // used as path prefix in storage

  // Parse the multipart body
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${uploaderSlug}/${params.id}.${ext}`
  const bytes = await file.arrayBuffer()

  // Upload using admin client so guests can write to the private bucket
  const { error: uploadErr } = await admin.storage
    .from('screenshots')
    .upload(path, bytes, { upsert: true, contentType: file.type })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // ── Score read by the client (Tesseract.js, runs in the browser — free,
  // no external API) ──
  // This is a suggestion, not a decision: it only ever prefills the score
  // field client-side and tags the match with a confidence badge for the
  // organizer. Players still type/confirm their own result, and the
  // organizer still confirms it — the AI never writes a score or finalizes
  // a match on its own.
  const ocrRaw = formData.get('ocr')
  let parsed: { confidence?: unknown } | null = null
  if (typeof ocrRaw === 'string') {
    try {
      parsed = JSON.parse(ocrRaw)
    } catch {
      parsed = null
    }
  }

  if (parsed && (parsed.confidence === 'high' || parsed.confidence === 'low')) {
    const { error: updateErr } = await admin
      .from('matches')
      .update({ ai_score_confidence: parsed.confidence })
      .eq('id', params.id)

    if (!updateErr) {
      const { data: matchRow } = await admin.from('matches').select('tournament_id').eq('id', params.id).single()

      // Invalidate the manage page so the AI confidence badge shows up once
      // the player actually submits their score.
      if (matchRow?.tournament_id) {
        revalidatePath(`/tournaments/${matchRow.tournament_id}/manage`)
      }
    }
  }

  return NextResponse.json({ path })
}
