'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createWorker, type Worker } from 'tesseract.js'

export type ScreenshotUploadStatus = 'idle' | 'scanning' | 'uploading' | 'done' | 'error'

export interface AiNotice {
  type: 'high' | 'low' | 'auto_finalized'
  text: string
}

interface OcrWord {
  text: string
  confidence: number
  bbox: { x0: number }
}

export interface OcrScore {
  player1_score: number
  player2_score: number
  confidence: 'high' | 'low'
}

interface ScoreCandidate {
  value: number
  confidence: number
  x: number
}

// eFootball's scoreboard is large, high-contrast digits — Tesseract reads it well
// above 70 on a clean screenshot. A false "high" here causes an unreviewed
// auto-finalize server-side, so this stays conservative rather than lenient.
const CONFIDENCE_THRESHOLD = 70
// Generous multiple of the typical case (~1-5s on a modern phone). Past this we
// give up rather than leave someone stuck on "scanning" indefinitely.
const OCR_TIMEOUT_MS = 20000

/**
 * Picks the two most plausible score digits out of everything Tesseract read.
 * Mirrors the old Gemini prompt's assumption that player 1 is on the left.
 */
function extractScoreFromWords(words: OcrWord[]): OcrScore | null {
  const candidates: ScoreCandidate[] = []
  for (const w of words) {
    const t = w.text.trim()
    if (/^\d{1,2}$/.test(t)) {
      candidates.push({ value: parseInt(t, 10), confidence: w.confidence, x: w.bbox.x0 })
    }
  }

  if (candidates.length < 2) return null

  // More than two numeric tokens: keep the two Tesseract is most sure about.
  // Position alone isn't reliable here since nothing guarantees a consistent
  // crop/layout, but confidence self-corrects — noisy picks usually also fail
  // the threshold below rather than silently producing a false "high".
  const chosen =
    candidates.length === 2
      ? candidates
      : [...candidates].sort((a, b) => b.confidence - a.confidence).slice(0, 2)

  chosen.sort((a, b) => a.x - b.x)
  const [left, right] = chosen
  const confidence: 'high' | 'low' =
    left.confidence >= CONFIDENCE_THRESHOLD && right.confidence >= CONFIDENCE_THRESHOLD ? 'high' : 'low'

  return { player1_score: left.value, player2_score: right.value, confidence }
}

interface UseScreenshotScoreOptions {
  matchId: string | null
  /** Guests authenticate via participant id; registered users via session (no header). */
  participantId: string | null
  currentUserId: string | null
  onScoreDetected: (player1Score: number, player2Score: number) => void
}

/**
 * Handles a screenshot upload end to end: reads the score client-side with
 * Tesseract.js (free, runs on the visitor's own device — no external API, no
 * bill, nothing that can go down or rate-limit), then uploads the image with
 * the extracted result attached so the server can write it and auto-finalize
 * on a confident read exactly as it did when Gemini produced that signal.
 */
export function useScreenshotScore({ matchId, participantId, currentUserId, onScoreDetected }: UseScreenshotScoreOptions) {
  const router = useRouter()
  const workerRef = useRef<Worker | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [uploadStatus, setUploadStatus] = useState<ScreenshotUploadStatus>('idle')
  const [uploadFileName, setUploadFileName] = useState('')
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null)
  const [aiNotice, setAiNotice] = useState<AiNotice | null>(null)

  useEffect(() => {
    return () => {
      workerRef.current?.terminate().catch(() => {})
      workerRef.current = null
    }
  }, [])

  async function ensureWorker(): Promise<Worker> {
    if (!workerRef.current) {
      workerRef.current = await createWorker('eng')
    }
    return workerRef.current
  }

  async function recognizeScore(file: File): Promise<{ ocr: OcrScore | null; timedOut: boolean }> {
    let timedOut = false
    const worker = await ensureWorker()

    const recognizePromise = worker
      .recognize(file)
      .then((res) => extractScoreFromWords((res.data.words ?? []) as OcrWord[]))
      .catch(() => null)

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        timedOut = true
        resolve(null)
      }, OCR_TIMEOUT_MS)
    })

    const ocr = await Promise.race([recognizePromise, timeoutPromise])

    if (timedOut) {
      // Don't trust a worker that may still be mid-recognition — drop it and
      // let the next attempt lazily create a fresh one.
      workerRef.current?.terminate().catch(() => {})
      workerRef.current = null
    }

    return { ocr, timedOut }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !matchId) return

    setUploadStatus('scanning')
    setUploadFileName(file.name)
    setScreenshotPath(null)
    setAiNotice(null)

    const { ocr, timedOut } = await recognizeScore(file)

    setUploadStatus('uploading')

    const form = new FormData()
    form.append('file', file)
    if (ocr) form.append('ocr', JSON.stringify(ocr))

    const headers: Record<string, string> = {}
    if (!currentUserId && participantId) headers['X-Participant-Id'] = participantId

    const res = await fetch(`/api/matches/${matchId}/screenshot`, {
      method: 'POST',
      headers,
      body: form,
    })

    if (!res.ok) {
      setUploadStatus('error')
      return
    }

    const data = (await res.json()) as { path: string; autoFinalized: boolean }
    setUploadStatus('done')
    setScreenshotPath(data.path)

    if (ocr) {
      if (ocr.confidence === 'high') {
        onScoreDetected(ocr.player1_score, ocr.player2_score)
        if (data.autoFinalized) {
          setAiNotice({
            type: 'auto_finalized',
            text: `🤖 AI read the score as ${ocr.player1_score}–${ocr.player2_score} with high confidence — the result has been confirmed automatically!`,
          })
          router.refresh()
        } else {
          setAiNotice({
            type: 'high',
            text: `🤖 AI read the score as ${ocr.player1_score}–${ocr.player2_score} with high confidence — prefilled below. Double-check it and submit.`,
          })
        }
      } else {
        setAiNotice({
          type: 'low',
          text: '🤖 AI scanned the screenshot but wasn’t confident in the score — please enter it manually below.',
        })
      }
    } else if (timedOut) {
      setAiNotice({ type: 'low', text: '🤖 AI scan took too long to finish — please enter the score manually below.' })
    } else {
      setAiNotice({ type: 'low', text: '🤖 AI couldn’t find a clear score in the screenshot — please enter it manually below.' })
    }
  }

  function clear() {
    setUploadStatus('idle')
    setUploadFileName('')
    setScreenshotPath(null)
    setAiNotice(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return { uploadStatus, uploadFileName, screenshotPath, aiNotice, fileRef, handleFile, clear }
}
