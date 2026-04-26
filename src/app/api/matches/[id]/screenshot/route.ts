import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Identify who is uploading
  let uploaderSlug: string | null = null // used as path prefix in storage

  if (user) {
    uploaderSlug = user.id
  } else {
    // Guest: verify X-Participant-Id
    const participantId = request.headers.get('X-Participant-Id')
    if (!participantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: participant } = await admin
      .from('participants')
      .select('id, name')
      .eq('id', participantId)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify participant is in this match
    const { data: match } = await admin
      .from('matches')
      .select('player1_name, player2_name')
      .eq('id', params.id)
      .single()

    if (
      !match ||
      (match.player1_name !== participant.name && match.player2_name !== participant.name)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    uploaderSlug = participant.id
  }

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
  const admin = createAdminClient()
  const { error: uploadErr } = await admin.storage
    .from('screenshots')
    .upload(path, bytes, { upsert: true, contentType: file.type })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  return NextResponse.json({ path })
}
