import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const DAYS = 30

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

function lastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function bucketByDay(timestamps: string[], days: string[]): number[] {
  const counts = new Map(days.map((d) => [d, 0]))
  for (const ts of timestamps) {
    const k = dayKey(ts)
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return days.map((d) => counts.get(d) ?? 0)
}

export async function GET() {
  const admin_user = await requireSuperAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - DAYS)
  const sinceIso = since.toISOString()

  const [
    { data: signups },
    { data: tournamentsCreated },
    { data: joins },
    { count: publicTournaments },
    { count: privateTournaments },
  ] = await Promise.all([
    db.from('profiles').select('created_at').gte('created_at', sinceIso),
    db.from('tournaments').select('created_at').gte('created_at', sinceIso),
    db.from('participants').select('joined_at').gte('joined_at', sinceIso),
    db.from('tournaments').select('*', { count: 'exact', head: true }).eq('is_public', true),
    db.from('tournaments').select('*', { count: 'exact', head: true }).eq('is_public', false),
  ])

  const days = lastNDays(DAYS)

  return NextResponse.json({
    days,
    signups: bucketByDay((signups ?? []).map((r) => r.created_at as string), days),
    tournamentsCreated: bucketByDay((tournamentsCreated ?? []).map((r) => r.created_at as string), days),
    joins: bucketByDay((joins ?? []).map((r) => r.joined_at as string), days),
    publicTournaments: publicTournaments ?? 0,
    privateTournaments: privateTournaments ?? 0,
  })
}
