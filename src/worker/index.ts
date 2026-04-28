/* eslint-disable */
// @ts-nocheck
// Custom service worker additions — merged by @ducanh2912/next-pwa with the generated Workbox SW.
// This file runs in the service worker context (not browser/Node).

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'eFootball Cup', body: event.data.text() } }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'eFootball Cup', {
      body: data.body ?? '',
      icon: data.icon ?? '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url ?? '/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((c) => c.navigate(url))
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

// ── Background Sync (offline score submission) ────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-match-score') {
    event.waitUntil(replayPendingScores())
  }
})

async function replayPendingScores() {
  try {
    const db = await openDB()
    const all = await promisify(db.transaction('pending-scores', 'readwrite').objectStore('pending-scores').getAll())
    for (const item of all) {
      try {
        const res = await fetch(item.url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: item.body })
        if (res.ok) {
          const tx = db.transaction('pending-scores', 'readwrite')
          tx.objectStore('pending-scores').delete(item.id)
        }
      } catch { /* still offline */ }
    }
  } catch { /* indexeddb unavailable */ }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('efootball-pwa', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('pending-scores', { keyPath: 'id', autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
