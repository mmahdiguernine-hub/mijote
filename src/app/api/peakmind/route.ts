import { NextResponse, type NextRequest } from 'next/server'

// Relais serveur vers PeakMind : evite les problemes CORS et ne contacte que l'adresse PeakMind
// saisie par l'utilisateur, en HTTPS (HTTP seulement pour un PeakMind lance en local).
export async function POST(request: NextRequest) {
  let body: { url?: unknown; token?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  if (typeof body.url !== 'string' || typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 500) {
    return NextResponse.json({ error: 'Adresse ou code de liaison PeakMind manquant' }, { status: 400 })
  }
  let base: URL
  try {
    base = new URL(body.url)
  } catch {
    return NextResponse.json({ error: 'Adresse PeakMind invalide' }, { status: 400 })
  }
  const local = base.hostname === 'localhost' || base.hostname === '127.0.0.1'
  if (base.protocol !== 'https:' && !(local && base.protocol === 'http:')) {
    return NextResponse.json({ error: 'L’adresse PeakMind doit commencer par https://' }, { status: 400 })
  }

  try {
    const res = await fetch(new URL('/api/export/mijote', base.origin), {
      headers: { Authorization: `Bearer ${body.token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 401) return NextResponse.json({ error: 'Code de liaison refusé par PeakMind : génère-en un nouveau dans les réglages PeakMind.' }, { status: 401 })
    if (!res.ok) return NextResponse.json({ error: `PeakMind a répondu ${res.status}` }, { status: 502 })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'PeakMind injoignable' }, { status: 502 })
  }
}
