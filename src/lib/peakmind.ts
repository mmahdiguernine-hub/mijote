import type { SportProfile, TimeOfDay } from '@/domain/types'
import { parsePeakmindExport } from '@/domain/peakmind'

/** Recupere le plan PeakMind via le relais serveur de Mijote, puis le valide. */
export async function syncFromPeakmind(link: NonNullable<SportProfile['peakmind']>, defaultTime: TimeOfDay) {
  const res = await fetch('/api/peakmind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link.url, token: link.token }) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && typeof data.error === 'string' && data.error) || 'Synchronisation impossible')
  return parsePeakmindExport(data, defaultTime)
}
