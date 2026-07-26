'use client'

import { useEffect, useRef, useState } from 'react'
import { createWorker, PSM, type Worker } from 'tesseract.js'
import { preprocessImage, extractScore, type OcrScore } from '@/lib/utils/screenshot-ocr'

export type ScreenshotUploadStatus = 'idle' | 'scanning' | 'uploading' | 'done' | 'error'

export interface AiNotice {
  type: 'high' | 'low'
  text: string
}

// Generous multiple of the typical case (~1-5s on a modern phone). Past this we
// give up rather than leave someone stuck on "scanning" indefinitely.
const OCR_TIMEOUT_MS = 20000

interface UseScreenshotScoreOptions {
  matchId: string | null
  /** Guests authenticate via participant id; registered users via session (no header). */
  participantId: string | null
  currentUserId: string | null
  /** Used to attribute each score to the right player instead of guessing by position. */
  player1Name: string | null
  player2Name: string | null
  onScoreDetected: (player1Score: number, player2Score: number) => void
}

/**
 * Handles a screenshot upload end to end: reads the score client-side with
 * Tesseract.js (free, runs on the visitor's own device — no external API, no
 * bill, nothing that can go down or rate-limit), then uploads the image and,
 * on a confident read, prefills the score fields as a suggestion. It never
 * submits or finalizes anything on its own — players type/confirm their own
 * result, same as always.
 */
export function useScreenshotScore({
  matchId,
  participantId,
  currentUserId,
  player1Name,
  player2Name,
  onScoreDetected,
}: UseScreenshotScoreOptions) {
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
      const worker = await createWorker('eng')
      // A game HUD is scattered text over a busy background, not a page of
      // paragraphs — sparse-text mode is a better fit than the page-layout
      // assumption Tesseract defaults to.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
      workerRef.current = worker
    }
    return workerRef.current
  }

  async function recognizeScore(file: File): Promise<{ ocr: OcrScore | null; timedOut: boolean }> {
    let timedOut = false
    const worker = await ensureWorker()

    const recognizePromise = (async () => {
      const image = await preprocessImage(file).catch(() => file)
      const res = await worker.recognize(image)
      return extractScore(res.data, player1Name, player2Name)
    })().catch(() => null)

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

    const data = (await res.json()) as { path: string }
    setUploadStatus('done')
    setScreenshotPath(data.path)

    if (ocr) {
      if (ocr.confidence === 'high') {
        onScoreDetected(ocr.player1_score, ocr.player2_score)
        setAiNotice({
          type: 'high',
          text: `🤖 AI read the score as ${ocr.player1_score}–${ocr.player2_score} with high confidence — prefilled below. Double-check it and submit.`,
        })
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
