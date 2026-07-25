import type { Page, Bbox } from 'tesseract.js'

export interface OcrScore {
  player1_score: number
  player2_score: number
  confidence: 'high' | 'low'
}

interface DigitCandidate {
  value: number
  confidence: number
  x: number
  y: number
}

interface NameAnchor {
  x: number
  y: number
}

// eFootball's scoreboard is large, high-contrast digits — Tesseract reads it well
// above 70 on a clean screenshot. A false "high" here causes an unreviewed
// auto-finalize server-side, so this stays conservative rather than lenient.
const CONFIDENCE_THRESHOLD = 70
// How closely a run of recognized words has to match a known player name
// before we trust it as "this text belongs to that player." OCR noise means
// an exact match is unrealistic; 0.5 tolerates a fair amount of misreading
// without accepting an unrelated word/phrase.
const NAME_MATCH_THRESHOLD = 0.5
// Names span at most this many consecutive OCR words ("Khelif Heisenberg").
// Matching at the word/phrase level — not the whole line — matters because a
// score line often reads as one run-on line, e.g. "Peiwei 1 0 The Legend":
// comparing that whole line against "Peiwei" dilutes the similarity score
// past the threshold, even though the name is right there.
const MAX_NAME_SPAN = 3

const MIN_PREPROCESS_DIMENSION = 1000

/**
 * Upscales small/compressed screenshots, converts to grayscale, and applies a
 * linear contrast stretch. Tesseract is much more reliable on crisp,
 * high-contrast input than on a raw phone screenshot straight off the game.
 */
export async function preprocessImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const smallerDimension = Math.min(bitmap.width, bitmap.height)
  const scale = smallerDimension < MIN_PREPROCESS_DIMENSION ? MIN_PREPROCESS_DIMENSION / smallerDimension : 1
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.drawImage(bitmap, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  const pixelCount = width * height
  const luminances = new Uint8ClampedArray(pixelCount)

  let min = 255
  let max = 0
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4
    const l = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2])
    luminances[i] = l
    if (l < min) min = l
    if (l > max) max = l
  }

  const range = max - min || 1
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4
    const stretched = Math.round(((luminances[i] - min) / range) * 255)
    data[o] = stretched
    data[o + 1] = stretched
    data[o + 2] = stretched
  }

  ctx.putImageData(imageData, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode preprocessed image'))
    }, 'image/png')
  })
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }

  return dp[b.length]
}

/** 1 = identical (after normalizing case/punctuation), 0 = nothing in common. */
function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  return 1 - levenshteinDistance(na, nb) / Math.max(na.length, nb.length)
}

function centerOf(bbox: Bbox) {
  return { x: (bbox.x0 + bbox.x1) / 2, y: (bbox.y0 + bbox.y1) / 2 }
}

/**
 * Finds the best-matching run of 1-3 consecutive OCR words for a player name,
 * anywhere on the page — not tied to Tesseract's own line grouping, which
 * tends to merge an entire scoreboard row (name + score + other name) into
 * one line and dilutes a whole-line comparison.
 */
function findNameAnchor(page: Page, targetName: string): NameAnchor | null {
  const words = page.words ?? []
  let best: { center: NameAnchor; score: number } | null = null

  for (let i = 0; i < words.length; i++) {
    for (let span = 1; span <= MAX_NAME_SPAN && i + span <= words.length; span++) {
      const group = words.slice(i, i + span)
      const text = group.map((w) => w.text).join(' ')
      const score = similarity(text, targetName)
      if (score >= NAME_MATCH_THRESHOLD && (!best || score > best.score)) {
        const x0 = Math.min(...group.map((w) => w.bbox.x0))
        const y0 = Math.min(...group.map((w) => w.bbox.y0))
        const x1 = Math.max(...group.map((w) => w.bbox.x1))
        const y1 = Math.max(...group.map((w) => w.bbox.y1))
        best = { center: centerOf({ x0, y0, x1, y1 }), score }
      }
    }
  }

  return best?.center ?? null
}

function nearestCandidate(candidates: DigitCandidate[], point: NameAnchor): DigitCandidate | null {
  let best: DigitCandidate | null = null
  let bestDist = Infinity
  for (const c of candidates) {
    const dist = Math.hypot(c.x - point.x, c.y - point.y)
    if (dist < bestDist) {
      bestDist = dist
      best = c
    }
  }
  return best
}

/** The two candidates that sit closest to each other — a real score is always
 *  a tight left-right pair, unlike stats-table or date/time digits, which are
 *  scattered one at a time. */
function findClosestPair(candidates: DigitCandidate[]): [DigitCandidate, DigitCandidate] | null {
  if (candidates.length < 2) return null
  let best: [DigitCandidate, DigitCandidate] | null = null
  let bestDist = Infinity
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const dist = Math.hypot(candidates[i].x - candidates[j].x, candidates[i].y - candidates[j].y)
      if (dist < bestDist) {
        bestDist = dist
        best = [candidates[i], candidates[j]]
      }
    }
  }
  return best
}

function toScore(p1: DigitCandidate, p2: DigitCandidate): OcrScore {
  const confidence: 'high' | 'low' =
    p1.confidence >= CONFIDENCE_THRESHOLD && p2.confidence >= CONFIDENCE_THRESHOLD ? 'high' : 'low'
  return { player1_score: p1.value, player2_score: p2.value, confidence }
}

/**
 * Picks the two most plausible score digits out of everything Tesseract read,
 * and figures out which belongs to which player.
 *
 * Real screenshots carry a lot more than just the two score digits — stats
 * tables, dates, match history rows — so this can't just grab "the two most
 * confident numbers on the page." Instead:
 *  1. If BOTH player names can be matched to text on the page, each score is
 *     whichever digit sits nearest that name — this is what actually answers
 *     "which team scored how many goals" instead of guessing.
 *  2. If only ONE name matches (the opponent's own account name isn't always
 *     shown), anchor that player's score by name, then take its nearest
 *     digit-neighbor as the other player's score — the two score digits are
 *     always a tight pair next to each other.
 *  3. If neither name matches, fall back to the closest pair of digits
 *     anywhere on the page, ordered left-to-right — still far more reliable
 *     on a stats-heavy screenshot than "most confident digits" would be,
 *     since a real score is always two numbers right next to each other.
 */
export function extractScore(page: Page, player1Name: string | null, player2Name: string | null): OcrScore | null {
  const digitCandidates: DigitCandidate[] = []
  for (const w of page.words ?? []) {
    const t = w.text.trim()
    if (/^\d{1,2}$/.test(t)) {
      const { x, y } = centerOf(w.bbox)
      digitCandidates.push({ value: parseInt(t, 10), confidence: w.confidence, x, y })
    }
  }

  if (digitCandidates.length < 2) return null

  const anchor1 = player1Name ? findNameAnchor(page, player1Name) : null
  const anchor2 = player2Name ? findNameAnchor(page, player2Name) : null

  if (anchor1 && anchor2) {
    const nearest1 = nearestCandidate(digitCandidates, anchor1)
    const nearest2 = nearestCandidate(digitCandidates, anchor2)
    if (nearest1 && nearest2 && nearest1 !== nearest2) {
      return toScore(nearest1, nearest2)
    }
  }

  if (anchor1 && !anchor2) {
    const nearest1 = nearestCandidate(digitCandidates, anchor1)
    if (nearest1) {
      const nearest2 = nearestCandidate(
        digitCandidates.filter((c) => c !== nearest1),
        nearest1
      )
      if (nearest2) return toScore(nearest1, nearest2)
    }
  }

  if (anchor2 && !anchor1) {
    const nearest2 = nearestCandidate(digitCandidates, anchor2)
    if (nearest2) {
      const nearest1 = nearestCandidate(
        digitCandidates.filter((c) => c !== nearest2),
        nearest2
      )
      if (nearest1) return toScore(nearest1, nearest2)
    }
  }

  const pair = findClosestPair(digitCandidates)
  if (!pair) return null
  const [left, right] = pair.sort((a, b) => a.x - b.x)
  return toScore(left, right)
}
