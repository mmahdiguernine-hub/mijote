import type { TimeOfDay, TrainingSession } from './types'
import { mapPeakmindType } from './sport'

// Format d'echange avec PeakMind (route GET /api/export/mijote cote PeakMind). Le contrat est
// volontairement minimal et versionne : Mijote ne lit que ce dont il a besoin, et ignore tout
// champ inconnu. Les donnees recues sont VALIDEES ici (jamais utilisees telles quelles).

export type PeakmindExport = {
  version: 1
  sessions: { date: string; type: string; title?: string | null; duration_minutes: number; distance_km?: number | null; elevation_m?: number | null }[]
  races: { id: string; name: string; race_date: string; distance_km: number; elevation_m?: number | null; target_time_seconds?: number | null }[]
}

export type ImportedRace = { id: string; name: string; date: string; distanceKm: number; elevationM?: number; targetMinutes?: number; source: 'peakmind' }

const ISO = /^\d{4}-\d{2}-\d{2}$/

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined

export function parsePeakmindExport(raw: unknown, defaultTime: TimeOfDay): { sessions: TrainingSession[]; races: ImportedRace[]; skipped: number } {
  if (!raw || typeof raw !== 'object') throw new Error('Réponse PeakMind illisible')
  const data = raw as Partial<PeakmindExport>
  if (data.version !== 1) throw new Error('Version de PeakMind incompatible : mets à jour les deux applications')
  let skipped = 0
  const sessions: TrainingSession[] = []
  for (const [i, s] of (Array.isArray(data.sessions) ? data.sessions : []).entries()) {
    const mapped = s && typeof s.type === 'string' ? mapPeakmindType(s.type) : null
    const duration = num(s?.duration_minutes, 1, 1440)
    if (!mapped || !s || typeof s.date !== 'string' || !ISO.test(s.date) || !duration) {
      if (s?.type !== 'repos') skipped++
      continue
    }
    sessions.push({
      id: `pm-${s.date}-${i}`, date: s.date, sport: mapped.sport, kind: mapped.kind, durationMinutes: Math.round(duration),
      distanceKm: num(s.distance_km, 0, 400), elevationM: num(s.elevation_m, 0, 20000),
      title: typeof s.title === 'string' ? s.title.slice(0, 80) : undefined, timeOfDay: defaultTime, source: 'peakmind',
    })
  }
  const races: ImportedRace[] = []
  for (const r of Array.isArray(data.races) ? data.races : []) {
    const distance = num(r?.distance_km, 0.1, 1000)
    if (!r || typeof r.race_date !== 'string' || !ISO.test(r.race_date) || !distance || typeof r.name !== 'string') { skipped++; continue }
    const target = num(r.target_time_seconds, 60, 7 * 86400)
    races.push({ id: `pm-race-${String(r.id).slice(0, 40)}`, name: r.name.slice(0, 80), date: r.race_date, distanceKm: distance, elevationM: num(r.elevation_m, 0, 20000), targetMinutes: target ? Math.round(target / 60) : undefined, source: 'peakmind' })
  }
  return { sessions, races, skipped }
}
