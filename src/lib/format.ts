import type { Confidence } from '@/domain/types'
import { addDays } from '@/domain/shopping'

export const euro = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: n < 10 ? 2 : 0, maximumFractionDigits: 2 })

export function minutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`
}

/** "Aujourd'hui", "Demain", ou la date ; sans `today`, toujours la date complete. */
export function dayLabel(iso: string, today?: string, style: 'long' | 'short' = 'long'): string {
  if (!today) return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  if (iso === today) return 'Aujourd’hui'
  if (iso === addDays(today, 1)) return 'Demain'
  if (iso === addDays(today, -1)) return 'Hier'
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('fr-FR', style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric' })
}

export const weekdayShort = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
export const dayNumber = (iso: string) => new Date(`${iso}T12:00:00`).getDate()

export const CONFIDENCE_LABEL: Record<Confidence, string> = { haute: 'fiable', moyenne: 'approximatif', faible: 'très incertain' }

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
