// Service worker Mijote -- jusqu'ici enregistre (layout.tsx) mais ne faisant que relayer les
// requetes sans rien mettre en cache (aucun benefice reel de vitesse/hors-ligne malgre la PWA deja
// configuree via manifest.json). Cf. audit interface, section PWA.
//
// Strategie volontairement simple et sure :
// - Assets statiques Next.js (/_next/static/...) : cache-first -- ils sont immuables (hash dans
//   l'URL a chaque build), aucun risque de servir une version perimee.
// - Navigation (pages HTML) : network-first avec repli sur le cache -- toujours la version la plus
//   fraiche quand le reseau repond, mais quelque chose s'affiche meme hors-ligne/reseau faible.
// - Tout le reste (API, Supabase, requetes non-GET) : jamais mis en cache -- donnees personnelles/
//   dynamiques, une reponse en cache serait fausse ou perimee (plan du jour, activites...).
// v2 (2026-09-20) : icon-192.png/icon-512.png etaient corrompus (SVG brut mal nomme) et deja mis en
// cache cache-first par des visites precedentes -- sans bump de version ici, le fix des icones
// (commit e570850) ne serait JAMAIS visible pour un utilisateur deja passe par l'app, meme apres
// deploiement, tant que son cache n'expire pas de lui-meme (jamais, en pratique, avec cache-first).
const CACHE_VERSION = 'v2'
const STATIC_CACHE = `mijote-static-${CACHE_VERSION}`
const PAGES_CACHE = `mijote-pages-${CACHE_VERSION}`

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('mijote-') && k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      )
      await clients.claim()
    })()
  )
})

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon-') || url.pathname === '/manifest.json'
}

function isApiOrData(url) {
  // Jamais de cache pour les routes API (LLM, Strava, ecritures) ni pour tout ce qui n'est pas
  // meme-origine (ex: Supabase, appele directement depuis le navigateur sur son propre domaine).
  return url.pathname.startsWith('/api/')
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return // laisse passer sans intercepter (POST/PATCH/DELETE...)

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // requetes tierces (Supabase, etc.) : jamais interceptees
  if (isApiOrData(url)) return // API : toujours reseau direct, jamais de cache

  if (isStaticAsset(url)) {
    e.respondWith(
      (async () => {
        const cached = await caches.match(req)
        if (cached) return cached
        const res = await fetch(req)
        if (res.ok) {
          const cache = await caches.open(STATIC_CACHE)
          cache.put(req, res.clone())
        }
        return res
      })()
    )
    return
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          if (res.ok) {
            const cache = await caches.open(PAGES_CACHE)
            cache.put(req, res.clone())
          }
          return res
        } catch (err) {
          const cached = await caches.match(req)
          return cached || caches.match('/')
        }
      })()
    )
  }
})

// --- Notifications push (seance allegee, seance du jour) ---------------------------------------------------------
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { title: 'Mijote', body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(data.title || 'Mijote', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'mijote',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { await c.focus(); if ('navigate' in c) await c.navigate(target); return }
    }
    await clients.openWindow(target)
  })())
})
