import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
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

  // ── Gemini vision: read score from screenshot ──
  // Reported back to the client so the UI can show "AI is scanning…" and then
  // whatever it found — otherwise there's no visible sign the feature is doing
  // anything beyond the plain upload.
  type AiOutcome =
    | { status: 'no_key' }
    | { status: 'error' }
    | { status: 'unparsable' }
    | { status: 'timeout' }
    | { status: 'read'; confidence: 'high' | 'low'; player1_score: number; player2_score: number; autoFinalized: boolean }

  let aiOutcome: AiOutcome = { status: 'no_key' }

  // Fire-and-forget with a 6s timeout so Vercel's 10s limit is never breached.
  const aiKey = process.env.GOOGLE_AI_API_KEY
  console.log('[screenshot] GOOGLE_AI_API_KEY present:', !!aiKey)
  if (aiKey) {
    const aiTask = (async (): Promise<AiOutcome> => {
      try {
        const genAI = new GoogleGenerativeAI(aiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const base64 = Buffer.from(bytes).toString('base64')
        console.log('[screenshot] Calling Gemini, image size:', bytes.byteLength, 'bytes')

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
              data: base64,
            },
          },
          `This is a screenshot from an eFootball video game match result screen.
Extract the final score for both players (player 1 on the left, player 2 on the right).
Return ONLY valid JSON with no extra text:
{"player1_score": number, "player2_score": number, "confidence": "high" | "low"}
Use "low" confidence if the score is not clearly visible, the image is cropped, or you are unsure.`,
        ])

        const raw = result.response.text().trim()
        console.log('[screenshot] Gemini raw response:', raw)

        // Strip markdown code fences Gemini sometimes adds
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        const parsed = JSON.parse(cleaned) as {
          player1_score: unknown
          player2_score: unknown
          confidence: unknown
        }
        console.log('[screenshot] Parsed:', parsed)

        if (
          typeof parsed.player1_score === 'number' &&
          typeof parsed.player2_score === 'number' &&
          parsed.player1_score >= 0 &&
          parsed.player2_score >= 0
        ) {
          const confidence = parsed.confidence === 'high' ? 'high' : 'low'
          const updates: Record<string, unknown> = { ai_score_confidence: confidence }

          // Only overwrite scores when AI is confident
          if (confidence === 'high') {
            updates.player1_score = parsed.player1_score
            updates.player2_score = parsed.player2_score
          }

          const { error: updateErr } = await admin.from('matches').update(updates).eq('id', params.id)
          console.log('[screenshot] DB update result:', updateErr ?? 'OK', 'updates:', updates)
          if (updateErr) return { status: 'error' }

          const { data: matchRow } = await admin.from('matches').select('tournament_id').eq('id', params.id).single()

          // High-confidence read: auto-finalize the match — no organizer click needed.
          // Silently no-op if it can't finalize yet (already completed, or a draw in a
          // knockout match) — the score update above still stands either way.
          let autoFinalized = false
          if (confidence === 'high') {
            const finalizeResult = await finalizeMatch(admin, params.id, {
              player1Score: parsed.player1_score,
              player2Score: parsed.player2_score,
              submittedBy: null,
            })
            console.log('[screenshot] Auto-finalize result:', finalizeResult)
            autoFinalized = finalizeResult.ok
          }

          // Invalidate the manage page (AI badge / confirmed status) and the public
          // tournament page (standings/bracket may have just changed)
          if (matchRow?.tournament_id) {
            revalidatePath(`/tournaments/${matchRow.tournament_id}/manage`)
            revalidatePath(`/tournaments/${matchRow.tournament_id}`)
            console.log('[screenshot] Revalidated pages for tournament:', matchRow.tournament_id)
          }

          return {
            status: 'read',
            confidence,
            player1_score: parsed.player1_score,
            player2_score: parsed.player2_score,
            autoFinalized,
          }
        }

        return { status: 'unparsable' }
      } catch (err) {
        console.error('[screenshot] Gemini error:', err)
        return { status: 'error' }
      }
    })()

    // Race against a 6-second budget (leaves buffer before Vercel's 10s cut-off)
    aiOutcome = await Promise.race([
      aiTask,
      new Promise<AiOutcome>((resolve) => setTimeout(() => resolve({ status: 'timeout' }), 6000)),
    ])
  }

  return NextResponse.json({ path, ai: aiOutcome })
}
