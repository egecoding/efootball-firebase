/**
 * Generates PWA icons for the eFootball Cup app.
 * Run: node scripts/gen-icons.mjs
 * Requires: sharp (bundled with Next.js image pipeline)
 */
import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Dark background
  ctx.fillStyle = '#09090b'
  ctx.fillRect(0, 0, size, size)

  // Rounded rect clip (maskable safe zone)
  const r = size * 0.18
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.clip()

  // Gold gradient circle
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.38)
  grad.addColorStop(0, '#fde68a')
  grad.addColorStop(0.5, '#d4af37')
  grad.addColorStop(1, '#92400e')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2)
  ctx.fill()

  // Soccer ball emoji-style icon
  const fontSize = Math.round(size * 0.42)
  ctx.font = `${fontSize}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⚽', size / 2, size / 2)

  return canvas.toBuffer('image/png')
}

try {
  const { createCanvas } = await import('canvas')
  writeFileSync(resolve(publicDir, 'icon-192.png'), generateIcon(192))
  writeFileSync(resolve(publicDir, 'icon-512.png'), generateIcon(512))
  writeFileSync(resolve(publicDir, 'apple-touch-icon.png'), generateIcon(180))
  console.log('Icons generated successfully.')
} catch {
  console.log('canvas package not available, skipping icon generation.')
}
