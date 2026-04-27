import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

  const admin = createAdminClient()

  if (user) {
    uploaderSlug = user.id
  } else {
    // Guest: verify X-Participant-Id
    const participantId = request.headers.get('X-Participant-Id')
    if (!participantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: participant, error: participantErr } = await admin
      .from('participants')
      .select('id, name')
      .eq('id', participantId)
      .single()

    if (participantErr || !participant) {
      return NextResponse.json(
        { error: participantErr?.message ?? 'Unauthorized' },
        { status: participantErr ? 500 : 401 }
      )
    }

    // Verify participant is in this match
    const { data: match, error: matchErr } = await admin
      .from('matches')
      .select('player1_name, player2_name')
      .eq('id', params.id)
      .single()

    if (matchErr) {
      return NextResponse.json({ error: matchErr.message }, { status: 500 })
    }

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
  const { error: uploadErr } = await admin.storage
    .from('screenshots')
    .upload(path, bytes, { upsert: true, contentType: file.type })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // ── Gemini vision: read score from screenshot ──
  // Fire-and-forget with a 6s timeout so Vercel's 10s limit is never breached.
  const aiKey = process.env.GOOGLE_AI_API_KEY
  console.log('[screenshot] GOOGLE_AI_API_KEY present:', !!aiKey)
  if (aiKey) {
    const aiTask = (async () => {
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
          if (!updateErr) {
            // Invalidate the manage page so the organizer sees the AI badge on next load/refresh
            const { data: matchRow } = await admin.from('matches').select('tournament_id').eq('id', params.id).single()
            if (matchRow?.tournament_id) {
              revalidatePath(`/tournaments/${matchRow.tournament_id}/manage`)
              console.log('[screenshot] Revalidated manage page for tournament:', matchRow.tournament_id)
            }
          }
        }
      } catch (err) {
        console.error('[screenshot] Gemini error:', err)
      }
    })()

    // Race against a 6-second budget (leaves buffer before Vercel's 10s cut-off)
    await Promise.race([
      aiTask,
      new Promise<void>((resolve) => setTimeout(resolve, 6000)),
    ])
  }

  return NextResponse.json({ path })
}
