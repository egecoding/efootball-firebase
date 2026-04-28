import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/share-target/assign
// Moves the temp share image to the match's screenshot slot
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { key, matchId } = body as { key?: string; matchId?: string }

  if (!key || !matchId) {
    return NextResponse.json({ error: 'key and matchId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify user is a player in this match
  const { data: match } = await admin
    .from('matches')
    .select('player1_id, player2_id, tournament_id')
    .eq('id', matchId)
    .single()

  if (!match || (match.player1_id !== user.id && match.player2_id !== user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Find the temp file and copy it to the permanent path
  const destPath = `${user.id}/${matchId}.jpg`
  for (const ext of ['jpeg', 'png', 'webp', 'jpg']) {
    const srcPath = `share-temp/${key}.${ext}`
    const { data: srcData } = await admin.storage.from('screenshots').download(srcPath)
    if (!srcData) continue

    const bytes = await srcData.arrayBuffer()
    await admin.storage.from('screenshots').upload(destPath, bytes, { upsert: true, contentType: 'image/jpeg' })
    // Clean up temp file
    await admin.storage.from('screenshots').remove([srcPath])

    // Update match screenshot_url
    await admin.from('matches').update({ screenshot_url: destPath }).eq('id', matchId)

    return NextResponse.json({ success: true, path: destPath })
  }

  return NextResponse.json({ error: 'Temp image not found' }, { status: 404 })
}
