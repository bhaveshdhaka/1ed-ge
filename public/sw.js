const VERSION = '1ed.ge-v1'
const ASSET_CACHE = '1ed-ge-assets'
const PAGE_CACHE = '1ed-ge-pages'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== ASSET_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/admin')) return

  if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/_astro/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const res = await fetch(request)
        if (res.ok) {
          const copy = res.clone()
          const cache = await caches.open(ASSET_CACHE)
          cache.put(request, copy)
        }
        return res
      })(),
    )
    return
  }

  // pages: network-first so content is always fresh, cache only on success
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request)
        if (res.ok) {
          const copy = res.clone()
          const cache = await caches.open(PAGE_CACHE)
          cache.put(request, copy)
        }
        return res
      } catch {
        const cached = await caches.match(request)
        if (cached) return cached
        const offline = await caches.match('/')
        return offline || Response.error()
      }
    })(),
  )
})
