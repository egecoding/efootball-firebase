import type { Page, Line } from 'tesseract.js'

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

// eFootball's scoreboard is large, high-contrast digits — Tesseract reads it well
// above 70 on a clean screenshot. A false "high" here causes an unreviewed
// auto-finalize server-side, so this stays conservative rather than lenient.
const CONFIDENCE_THRESHOLD = 70
// How much of a recognized text line has to match a known player name before
// we trust it as "this line belongs to that player." OCR noise means an exact
// match is unrealistic; 0.5 tolerates a fair amount of misreading without
// accepting an unrelated line.
const NAME_MATCH_THRESHOLD = 0.5

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

function findBestLine(lines: Line[], targetName: string): Line | null {
  let best: { line: Line; score: number } | null = null
  for (const line of lines) {
    const score = similarity(line.text, targetName)
    if (score >= NAME_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { line, score }
    }
  }
  return best?.line ?? null
}

function centerOf(bbox: { x0: number; y0: number; x1: number; y1: number }) {
  return { x: (bbox.x0 + bbox.x1) / 2, y: (bbox.y0 + bbox.y1) / 2 }
}

function nearestCandidate(candidates: DigitCandidate[], point: { x: number; y: number }): DigitCandidate | null {
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

/**
 * Picks the two most plausible score digits out of everything Tesseract read,
 * and figures out which belongs to which player.
 *
 * When both player names can be matched to a recognized text line, the score
 * nearest each name's line wins — this is what actually answers "which team
 * scored how many goals" instead of guessing. When name-matching isn't
 * possible (names not visible, or the in-game name doesn't resemble the
 * tournament nametag), this falls back to the original behavior: the two
 * highest-confidence digits, left = player 1. That fallback is the same
 * logic that shipped before name-matching existed, so accuracy never
 * regresses below today's baseline — the name-aware path only ever engages
 * when it can do strictly better.
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

  if (player1Name && player2Name) {
    const line1 = findBestLine(page.lines ?? [], player1Name)
    const line2 = findBestLine(page.lines ?? [], player2Name)

    if (line1 && line2) {
      const nearest1 = nearestCandidate(digitCandidates, centerOf(line1.bbox))
      const nearest2 = nearestCandidate(digitCandidates, centerOf(line2.bbox))

      if (nearest1 && nearest2 && nearest1 !== nearest2) {
        const confidence: 'high' | 'low' =
          nearest1.confidence >= CONFIDENCE_THRESHOLD && nearest2.confidence >= CONFIDENCE_THRESHOLD ? 'high' : 'low'
        return { player1_score: nearest1.value, player2_score: nearest2.value, confidence }
      }
    }
  }

  const chosen =
    digitCandidates.length === 2
      ? digitCandidates
      : [...digitCandidates].sort((a, b) => b.confidence - a.confidence).slice(0, 2)

  chosen.sort((a, b) => a.x - b.x)
  const [left, right] = chosen
  const confidence: 'high' | 'low' =
    left.confidence >= CONFIDENCE_THRESHOLD && right.confidence >= CONFIDENCE_THRESHOLD ? 'high' : 'low'

  return { player1_score: left.value, player2_score: right.value, confidence }
}
