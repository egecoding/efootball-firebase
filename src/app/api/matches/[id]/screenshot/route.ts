import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { finalizeMatch } from '@/lib/match-finalize'
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

  // This route can auto-finalize a match, so the caller must be verified as
  // belonging to it — registered users included.
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
  // We only ever apply this if it's well-formed: the caller is authorized
  // above, but the score/confidence themselves are client-reported and must
  // not be trusted blindly. A forged high-confidence result can still trigger
  // an unreviewed auto-finalize for a match the caller legitimately belongs
  // to — that's an accepted trade-off (same class of risk as the AI trusting
  // its own read used to be), mitigated by the existing dispute/correct flows,
  // not by anything here.
  let autoFinalized = false

  const ocrRaw = formData.get('ocr')
  let parsed: { player1_score?: unknown; player2_score?: unknown; confidence?: unknown } | null = null
  if (typeof ocrRaw === 'string') {
    try {
      parsed = JSON.parse(ocrRaw)
    } catch {
      parsed = null
    }
  }

  if (parsed) {
    const player1Score = parsed.player1_score
    const player2Score = parsed.player2_score
    const confidence = parsed.confidence

    if (
      Number.isInteger(player1Score) &&
      Number.isInteger(player2Score) &&
      (player1Score as number) >= 0 &&
      (player1Score as number) <= 99 &&
      (player2Score as number) >= 0 &&
      (player2Score as number) <= 99 &&
      (confidence === 'high' || confidence === 'low')
    ) {
      const updates: Record<string, unknown> = { ai_score_confidence: confidence }

      // Only overwrite scores when the read was confident
      if (confidence === 'high') {
        updates.player1_score = player1Score
        updates.player2_score = player2Score
      }

      const { error: updateErr } = await admin.from('matches').update(updates).eq('id', params.id)

      if (!updateErr) {
        const { data: matchRow } = await admin.from('matches').select('tournament_id').eq('id', params.id).single()

        // High-confidence read: auto-finalize the match — no organizer click needed.
        // Silently no-op if it can't finalize yet (already completed, or a draw in a
        // knockout match) — the score update above still stands either way.
        if (confidence === 'high') {
          const finalizeResult = await finalizeMatch(admin, params.id, {
            player1Score: player1Score as number,
            player2Score: player2Score as number,
            submittedBy: null,
          })
          autoFinalized = finalizeResult.ok
        }

        // Invalidate the manage page (AI badge / confirmed status) and the public
        // tournament page (standings/bracket may have just changed)
        if (matchRow?.tournament_id) {
          revalidatePath(`/tournaments/${matchRow.tournament_id}/manage`)
          revalidatePath(`/tournaments/${matchRow.tournament_id}`)
        }
      }
    }
  }

  return NextResponse.json({ path, autoFinalized })
}
