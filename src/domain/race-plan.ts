import type { Profile, SportProfile, TargetRace, TrainingSession, Recipe } from './types'
import type { Catalog } from './catalog'
import { analyzeCached } from './analysis'
import { eligibleVersion } from './scoring'
import { addDays } from './shopping'
import { dayNutrition, type DayNutrition, type Range } from './sport'

// Plan de nutrition pour une course : semaine qui precede (recharge progressive seulement pour les
// efforts longs), petit-dejeuner du jour J, ravitaillement pendant l'effort, recuperation.
// Repose sur dayNutrition (memes fourchettes partout dans l'app) ; les quantites de ravitaillement
// sont des reperes a tester a l'entrainement, jamais le jour J.

export type FuelingStep = { minute: number; action: string }

export type RaceFueling = {
  estimatedMinutes: number
  /** true si la duree vient d'une estimation (pas d'un temps vise saisi). */
  durationEstimated: boolean
  carbsPerHour: Range | null
  totalCarbs: Range | null
  /** Equivalent en gels de ~25 g de glucides. */
  gels: Range | null
  fluidMlPerHour: Range
  sodiumMgPerHour: Range | null
  solids: boolean
  schedule: FuelingStep[]
}

export type RacePlanDay = {
  date: string
  label: string
  nutrition: DayNutrition | null
  focus: string
  ideas: Recipe[]
}

export type RacePlan = {
  race: TargetRace & { targetMinutes?: number }
  days: RacePlanDay[]
  breakfast: { hoursBefore: number; carbs: Range | null; text: string; ideas: Recipe[] }
  fueling: RaceFueling
  recovery: string[]
  warnings: string[]
}

/** Duree estimee : temps vise si connu, sinon 6 min/km + 10 min par 100 m de D+ (a affiner). */
export function estimateRaceMinutes(race: TargetRace & { targetMinutes?: number }): { minutes: number; estimated: boolean } {
  if (race.targetMinutes) return { minutes: race.targetMinutes, estimated: false }
  return { minutes: Math.round(race.distanceKm * 6 + ((race.elevationM ?? 0) / 100) * 10), estimated: true }
}

export function raceFueling(race: TargetRace & { targetMinutes?: number }): RaceFueling {
  const { minutes, estimated } = estimateRaceMinutes(race)
  const hours = minutes / 60
  const carbsPerHour = minutes <= 60 ? null : minutes <= 150 ? { min: 30, max: 60 } : { min: 60, max: 90 }
  // Les glucides ne commencent qu'apres ~30 min d'effort.
  const fuelHours = Math.max(0, (minutes - 30) / 60)
  const totalCarbs = carbsPerHour ? { min: Math.round(carbsPerHour.min * fuelHours / 5) * 5, max: Math.round(carbsPerHour.max * fuelHours / 5) * 5 } : null
  const gels = totalCarbs ? { min: Math.max(1, Math.round(totalCarbs.min / 25)), max: Math.max(1, Math.round(totalCarbs.max / 25)) } : null
  const solids = minutes > 240
  const schedule: FuelingStep[] = []
  if (carbsPerHour) {
    const every = minutes > 150 ? 20 : 30
    let n = 0
    for (let t = 30; t <= minutes - 15; t += every, n++) {
      // Une prise sur trois (environ toutes les heures) en solide sur les efforts tres longs.
      const solid = solids && n % 3 === 2
      schedule.push({ minute: t, action: solid ? 'Aliment solide (barre, compote, fruits secs) + eau' : 'Gel ou quelques gorgées de boisson énergétique + eau' })
    }
  } else {
    schedule.push({ minute: 0, action: 'Pas besoin de ravitaillement solide sur cette durée : bois si tu as soif.' })
  }
  return {
    estimatedMinutes: minutes,
    durationEstimated: estimated,
    carbsPerHour,
    totalCarbs,
    gels,
    fluidMlPerHour: minutes <= 60 ? { min: 0, max: 400 } : { min: 400, max: 800 },
    sodiumMgPerHour: hours > 2 ? { min: 300, max: 600 } : null,
    solids,
    schedule,
  }
}

type IdeaFilter = 'recharge' | 'digeste' | 'petit_dejeuner' | 'recuperation'

/** Recettes du catalogue adaptees au moment (riches en glucides, digestes, ou proteinees). */
export function raceMealIdeas(catalog: Catalog, profile: Profile, kind: IdeaFilter, limit = 3): Recipe[] {
  const out: { r: Recipe; s: number }[] = []
  for (const base of catalog.recipes) {
    if (base.variant) continue
    const v = eligibleVersion(base, profile, catalog)
    if (!v) continue
    const a = analyzeCached(v.recipe, catalog)
    const n = a.nutrition.value
    const carbShare = n.kcal > 0 ? (n.carbs * 4) / n.kcal : 0
    if (kind === 'petit_dejeuner') {
      if (base.course !== 'petit_dejeuner' || n.fiber > 8 || n.fat > 18) continue
      out.push({ r: v.recipe, s: n.carbs - n.fat })
    } else if (kind === 'recuperation') {
      if (n.protein < 20 || !base.slots.some((x) => x !== 'petit_dejeuner')) continue
      out.push({ r: v.recipe, s: n.protein + n.carbs / 3 })
    } else {
      if (!['plat', 'salade'].includes(base.course) || carbShare < 0.45) continue
      // Recharge et veille : on reduit fibres et graisses (digestion), la veille encore plus strictement.
      if (n.fiber > (kind === 'digeste' ? 8 : 10) || n.fat > (kind === 'digeste' ? 22 : 28)) continue
      if (kind === 'digeste' && base.tags.includes('gourmand')) continue
      out.push({ r: v.recipe, s: n.carbs - (kind === 'digeste' ? n.fiber * 3 + n.fat : 0) })
    }
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.r)
}

export function buildRacePlan(input: {
  profile: Profile
  sport: SportProfile
  race: TargetRace & { targetMinutes?: number }
  sessions: TrainingSession[]
  catalog: Catalog
  today: string
}): RacePlan {
  const { profile, sport, race, sessions, catalog, today } = input
  const long = race.distanceKm >= 21
  const warnings: string[] = []
  if (!sport.weightKg) warnings.push('Renseigne ton poids dans le profil pour obtenir des quantités chiffrées.')

  const start = addDays(race.date, -6) < today ? today : addDays(race.date, -6)
  const days: RacePlanDay[] = []
  for (let d = start; d <= addDays(race.date, 1); d = addDays(d, 1)) {
    const offset = Math.round((Date.parse(race.date) - Date.parse(d)) / 86400000)
    const label = offset === 0 ? 'Jour J' : offset < 0 ? 'J+1' : offset === 1 ? 'Veille' : `J-${offset}`
    const nutrition = dayNutrition(sport, d, sessions, [race])
    let focus: string
    let ideas: Recipe[] = []
    if (offset === 0) {
      focus = 'Petit-déjeuner familier, ravitaillement prévu, récupération après l’arrivée.'
    } else if (offset < 0) {
      focus = 'Récupération : protéines à chaque repas, glucides pour refaire les réserves, beaucoup d’eau.'
      ideas = raceMealIdeas(catalog, profile, 'recuperation')
    } else if (long && offset <= 2) {
      focus = 'Recharge : féculents à chaque repas, moins de fibres et de graisses, rien de nouveau.'
      ideas = raceMealIdeas(catalog, profile, offset === 1 ? 'digeste' : 'recharge')
    } else if (offset === 1) {
      focus = 'Veille : dîner riche en glucides, digeste et connu.'
      ideas = raceMealIdeas(catalog, profile, 'digeste')
    } else {
      focus = 'Alimentation habituelle et équilibrée, hydratation régulière.'
    }
    days.push({ date: d, label, nutrition, focus, ideas })
  }

  const w = sport.weightKg
  const breakfast = {
    hoursBefore: 3,
    carbs: w ? { min: Math.round((w * 1.5) / 5) * 5, max: Math.round((w * 2.5) / 5) * 5 } : null,
    text: 'Environ 3 h avant le départ : un petit-déjeuner que tu as déjà testé, riche en glucides, pauvre en fibres et en graisses (pain blanc, miel, banane, riz...). Une petite collation (banane, compote) 45 min avant si besoin.',
    ideas: raceMealIdeas(catalog, profile, 'petit_dejeuner', 2),
  }

  const recovery = [
    w ? `Dans l’heure après l’arrivée : environ ${Math.round(w)} g de glucides et ${Math.round((w * 0.3) / 5) * 5} g de protéines (boisson de récupération, laitage + fruit, sandwich).` : 'Dans l’heure après l’arrivée : glucides et protéines (laitage + fruit, sandwich).',
    'Réhydrate-toi progressivement (eau + un peu de sel) dans les heures qui suivent.',
    'Le lendemain : repas normaux et protéinés, pas de restriction.',
  ]

  return { race, days, breakfast, fueling: raceFueling(race), recovery, warnings }
}
