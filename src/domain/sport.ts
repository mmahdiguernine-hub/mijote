import type { Confidence, MealSlot, SessionKind, SportProfile, TargetRace, TimeOfDay, TrainingSession } from './types'
import { addDays } from './shopping'

// Nutrition sportive : reperes quotidiens a partir du poids et des seances du jour.
//
// Sources des fourchettes (consensus, pas des prescriptions individuelles) :
// - Glucides selon la charge du jour : 3-5 g/kg (leger), 5-7 (modere ~1 h), 6-10 (1-3 h
//   d'endurance), recharge avant une course longue 8-10+ g/kg -- consensus CIO / ACSM (2016) et
//   Burke et al. Mijote reste volontairement dans le bas de la recharge (pas de protocole agressif,
//   meme philosophie que PeakMind).
// - Proteines : 1,2-1,6 g/kg en endurance, 1,6-2,0 g/kg avec de la musculation, jusqu'a 2,2 g/kg en
//   deficit energetique pour preserver la masse musculaire -- position ISSN (2017). Reparties sur
//   la journee : 0,3-0,4 g/kg par repas.
// - Lipides : 20-35 % de l'energie, jamais en dessous de ~0,8 g/kg.
// - Pendant l'effort : 30-60 g/h au-dela d'une heure, 60-90 g/h au-dela de 2 h 30.
// - Energie : metabolisme de base Mifflin-St Jeor x niveau d'activite + cout des seances
//   (course : ~1 kcal/kg/km ; sinon MET x poids x duree).
// Tout est affiche en fourchettes estimees, jamais comme un chiffre exact.

export type Range = { min: number; max: number }

export type DayType = 'repos' | 'leger' | 'force' | 'modere' | 'intense' | 'long' | 'recharge' | 'veille' | 'course'

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  repos: 'Jour de repos', leger: 'Séance légère', force: 'Musculation', modere: 'Séance modérée', intense: 'Séance intense',
  long: 'Sortie longue', recharge: 'Recharge en glucides', veille: 'Veille de course', course: 'Jour de course',
}

export const SESSION_LABEL: Record<SessionKind, string> = {
  endurance: 'Footing', sortie_longue: 'Sortie longue', seuil: 'Seuil', fractionne: 'Fractionné', recuperation: 'Récupération',
  trail: 'Trail', course_objectif: 'Course', force: 'Musculation', renfo_leger: 'Renfo léger',
}

const RUNNING_KINDS: SessionKind[] = ['endurance', 'sortie_longue', 'seuil', 'fractionne', 'recuperation', 'trail', 'course_objectif']

/** MET moyens (Compendium of Physical Activities, valeurs arrondies). */
const MET: Record<SessionKind, number> = {
  endurance: 8.5, sortie_longue: 8.5, seuil: 10.5, fractionne: 11, recuperation: 7, trail: 9, course_objectif: 10.5, force: 5, renfo_leger: 3.5,
}

const CARBS_G_PER_KG: Record<DayType, [number, number]> = {
  repos: [3, 5], leger: [4, 5], force: [4, 6], modere: [5, 7], intense: [6, 8], long: [7, 10], recharge: [8, 10], veille: [6, 8], course: [7, 10],
}

const ACTIVITY_FACTOR: Record<SportProfile['dailyActivity'], number> = { sedentaire: 1.2, leger: 1.375, actif: 1.55 }

export function isRunning(s: TrainingSession): boolean {
  return RUNNING_KINDS.includes(s.kind)
}

/** Depense estimee d'une seance, en kcal. */
export function sessionKcal(s: TrainingSession, weightKg: number): number {
  if (isRunning(s) && s.distanceKm) {
    // ~1 kcal/kg/km a plat ; le denivele positif ajoute l'equivalent d'environ 1 km par 100 m.
    return Math.round(weightKg * (s.distanceKm + (s.elevationM ?? 0) / 100))
  }
  return Math.round(MET[s.kind] * weightKg * (s.durationMinutes / 60))
}

/** Metabolisme de base (Mifflin-St Jeor) et fiabilite selon les donnees disponibles. */
export function basalMetabolism(p: SportProfile): { kcal: number; confidence: Confidence } | null {
  if (!p.weightKg) return null
  const complete = p.heightCm != null && p.ageYears != null && p.sex != null
  const height = p.heightCm ?? (p.sex === 'femme' ? 165 : p.sex === 'homme' ? 177 : 171)
  const age = p.ageYears ?? 30
  const sexTerm = p.sex === 'homme' ? 5 : p.sex === 'femme' ? -161 : -78
  return { kcal: Math.round(10 * p.weightKg + 6.25 * height - 5 * age + sexTerm), confidence: complete ? 'moyenne' : 'faible' }
}

/** Course objectif a venir dans les jours suivants (la plus proche). */
function raceAround(date: string, races: TargetRace[]): { race: TargetRace; daysUntil: number } | null {
  let best: { race: TargetRace; daysUntil: number } | null = null
  for (const r of races) {
    const d = diffDays(date, r.date)
    if (d < 0 || d > 3) continue
    if (!best || d < best.daysUntil) best = { race: r, daysUntil: d }
  }
  return best
}

function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function classifyDay(sessions: TrainingSession[], date: string, races: TargetRace[]): DayType {
  const near = raceAround(date, races)
  if (near?.daysUntil === 0) return 'course'
  // Recharge seulement avant un effort de plus de ~90 min (semi et plus) ; sinon une veille simple.
  if (near && near.race.distanceKm >= 21 && near.daysUntil <= 2) return 'recharge'
  if (near?.daysUntil === 1) return 'veille'

  const runs = sessions.filter(isRunning)
  const runMinutes = runs.reduce((s, x) => s + x.durationMinutes, 0)
  if (runs.some((x) => x.kind === 'course_objectif')) return 'course'
  if (runMinutes >= 90 || runs.some((x) => (x.kind === 'sortie_longue' || x.kind === 'trail') && x.durationMinutes >= 75)) return 'long'
  if (runs.some((x) => x.kind === 'seuil' || x.kind === 'fractionne')) return 'intense'
  if (runMinutes >= 45) return 'modere'
  if (sessions.some((x) => x.kind === 'force')) return 'force'
  if (sessions.length > 0) return 'leger'
  return 'repos'
}

export type DayNutrition = {
  date: string
  dayType: DayType
  sessions: TrainingSession[]
  race?: TargetRace
  energy: Range
  carbs: Range
  protein: Range
  fat: Range
  perMealProtein: Range
  /** Glucides par heure pendant l'effort, si une seance depasse une heure. */
  during?: Range
  exerciseKcal: number
  confidence: Confidence
  tips: string[]
  warnings: string[]
}

const r5 = (n: number) => Math.round(n / 5) * 5
const r50 = (n: number) => Math.round(n / 50) * 50

export function dayNutrition(p: SportProfile, date: string, sessions: TrainingSession[], races: TargetRace[]): DayNutrition | null {
  const bmr = basalMetabolism(p)
  if (!bmr || !p.weightKg) return null
  const w = p.weightKg
  const day = sessions.filter((s) => s.date === date)
  const dayType = classifyDay(day, date, races)
  const near = raceAround(date, races)
  const tips: string[] = []
  const warnings: string[] = []

  // Energie
  const exerciseKcal = day.reduce((s, x) => s + sessionKcal(x, w), 0)
  let energy = bmr.kcal * ACTIVITY_FACTOR[p.dailyActivity] + exerciseKcal
  const bigDay = ['long', 'recharge', 'course', 'intense'].includes(dayType)
  if (p.bodyGoal === 'perte') {
    if (bigDay) tips.push('Objectif de perte de poids mis en pause aujourd’hui : une grosse séance se prépare et se récupère avec assez d’énergie.')
    else energy = Math.max(energy * 0.85, bmr.kcal * 1.2)
  } else if (p.bodyGoal === 'prise') {
    energy *= 1.1
  }

  // Glucides
  let [cMin, cMax] = CARBS_G_PER_KG[dayType]
  const longest = Math.max(0, ...day.filter(isRunning).map((s) => s.durationMinutes))
  if (dayType === 'long' && longest >= 150) [cMin, cMax] = [8, 11]
  if (p.bodyGoal === 'perte' && !bigDay) [cMin, cMax] = [Math.max(3, cMin - 1), Math.max(4, cMax - 1)]

  // Proteines
  const strength = p.sports.includes('renfo') || day.some((s) => s.kind === 'force')
  let [pMin, pMax] = strength ? [1.6, 2.0] : [1.2, 1.6]
  if (p.bodyGoal === 'perte') [pMin, pMax] = [1.8, 2.2]

  const carbs = { min: r5(cMin * w), max: r5(cMax * w) }
  const protein = { min: r5(pMin * w), max: r5(pMax * w) }

  // Lipides : le reste de l'energie, borne a 20-35 % et au moins 0,8 g/kg
  const kcalFromCP = ((carbs.min + carbs.max) / 2) * 4 + ((protein.min + protein.max) / 2) * 4
  const fatMid = Math.max(0.8 * w, (energy - kcalFromCP) / 9)
  const fat = {
    min: r5(Math.max(0.8 * w, Math.min(fatMid, (energy * 0.35) / 9) * 0.85, (energy * 0.2) / 9)),
    max: r5(Math.min((energy * 0.35) / 9, Math.max(fatMid * 1.15, (energy * 0.2) / 9 + 5))),
  }
  if (kcalFromCP + 0.8 * w * 9 > energy * 1.1) {
    warnings.push('Les glucides et protéines recommandés dépassent presque l’énergie estimée : vérifie ton poids et ton niveau d’activité dans le profil.')
  }

  const during = longest > 150 ? { min: 60, max: 90 } : longest > 60 ? { min: 30, max: 60 } : undefined

  // Conseils de timing
  const main = [...day].sort((a, b) => b.durationMinutes - a.durationMinutes)[0]
  if (dayType === 'course' && near) {
    tips.push(`Jour de course (${near.race.name}) : repas familier riche en glucides 2 à 3 h avant le départ, peu de fibres et de graisses.`)
    if (near.race.distanceKm > 12) tips.push('Pendant : 30 à 90 g de glucides par heure selon la durée (gels, boisson), et bois à chaque ravitaillement.')
    tips.push('Après : glucides + protéines dans l’heure qui suit, puis un vrai repas.')
  } else if (dayType === 'recharge' && near) {
    tips.push(`${near.daysUntil === 1 ? 'Demain' : 'Dans 2 jours'} : ${near.race.name}. Augmente les féculents à chaque repas, réduis les fibres et les plats gras qui se digèrent lentement.`)
    tips.push('Aucune nouveauté alimentaire avant la course : uniquement des plats que tu connais.')
  } else if (dayType === 'veille' && near) {
    tips.push(`Course demain (${near.race.name}) : dîner riche en glucides et digeste, rien de nouveau, prépare ton ravitaillement ce soir.`)
  } else if (main) {
    if (dayType === 'long' || dayType === 'intense') tips.push('Avant la séance : repas riche en glucides 2 à 4 h avant, ou une collation légère (banane, pain-miel) 1 h avant. Évite la séance à jeun.')
    if (during) tips.push(`Pendant : vise ${during.min} à ${during.max} g de glucides par heure (gel, boisson, fruits secs) et bois régulièrement.`)
    if (main.kind === 'force') tips.push(`Après la musculation : un repas ou une collation avec ${r5(0.3 * w)} à ${r5(0.4 * w)} g de protéines dans les 2 heures.`)
    else if (dayType !== 'leger') tips.push(`Après : glucides + ${r5(0.3 * w)} g de protéines environ pour bien récupérer.`)
  } else {
    tips.push('Jour de repos : garde des protéines à chaque repas, les féculents peuvent être plus modérés.')
  }

  return {
    date, dayType, sessions: day, race: near?.race,
    energy: { min: r50(energy * 0.9), max: r50(energy * 1.1) },
    carbs, protein, fat,
    perMealProtein: { min: r5(0.3 * w), max: r5(0.4 * w) },
    during, exerciseKcal, confidence: bmr.confidence, tips, warnings,
  }
}

// --- Repas autour des seances ----------------------------------------------------------------

export type MealFocus = {
  carbs: 'haut' | 'normal'
  /** Proteines visees pour CE repas, par portion (g). */
  minProtein?: number
  /** Digeste : peu de graisses et de fibres (avant course, avant une seance proche). */
  light?: boolean
  reason: string
}

const SLOT_TIME: Record<MealSlot, number> = { petit_dejeuner: 8, dejeuner: 12.5, collation: 16.5, diner: 20 }
const SESSION_TIME: Record<TimeOfDay, number> = { matin: 9.5, midi: 12, soir: 18.5 }

/**
 * Ce qu'un repas doit apporter compte tenu des seances : avant une seance exigeante -> glucides ;
 * apres -> proteines (et glucides si la seance etait longue ou intense) ; recharge -> glucides a
 * chaque repas ; veille/jour de course -> digeste.
 */
export function mealFocus(p: SportProfile, date: string, slot: MealSlot, sessions: TrainingSession[], races: TargetRace[]): MealFocus | null {
  if (!p.enabled || !p.weightKg) return null
  const w = p.weightKg
  const today = sessions.filter((s) => s.date === date)
  const tomorrow = sessions.filter((s) => s.date === addDays(date, 1))
  const typeToday = classifyDay(today, date, races)
  const typeTomorrow = classifyDay(tomorrow, addDays(date, 1), races)
  const mealTime = SLOT_TIME[slot]
  const protein = r5(0.3 * w)

  if (typeToday === 'recharge') return { carbs: 'haut', light: true, reason: 'Recharge en glucides avant ta course' }
  if (typeToday === 'veille' && slot === 'diner') return { carbs: 'haut', light: true, reason: 'Veille de course : glucides et digeste' }
  if (typeToday === 'course') return mealTime < 14 ? { carbs: 'haut', light: true, reason: 'Jour de course : digeste et riche en glucides' } : { carbs: 'haut', minProtein: protein, reason: 'Récupération après ta course' }

  const demanding = (t: DayType) => t === 'long' || t === 'intense'
  for (const s of today) {
    const sessionTime = SESSION_TIME[s.timeOfDay ?? p.defaultTimeOfDay]
    const before = sessionTime - mealTime
    const sessionType = classifyDay([s], date, [])
    if (before > 0 && before <= 6.5 && demanding(sessionType)) {
      return { carbs: 'haut', light: before <= 3, reason: `Avant ta séance (${SESSION_LABEL[s.kind].toLowerCase()}) : riche en glucides${before <= 3 ? ', digeste' : ''}` }
    }
    if (before <= 0 && before > -4) {
      return { carbs: demanding(sessionType) ? 'haut' : 'normal', minProtein: protein, reason: `Après ta séance (${SESSION_LABEL[s.kind].toLowerCase()}) : récupération` }
    }
  }
  // Seance exigeante demain matin : le diner prepare.
  if (slot === 'diner' && demanding(typeTomorrow) && tomorrow.some((s) => (s.timeOfDay ?? p.defaultTimeOfDay) === 'matin')) {
    return { carbs: 'haut', reason: 'Prépare ta séance de demain matin : glucides ce soir' }
  }
  if (typeToday === 'force' || (p.sports.includes('renfo') && slot !== 'collation')) {
    return { carbs: 'normal', minProtein: protein, reason: 'Protéines réparties sur la journée' }
  }
  return null
}

/** Sessions PeakMind mappees vers le modele Mijote (types de seance PeakMind -> SessionKind). */
export function mapPeakmindType(type: string): { sport: 'course' | 'renfo'; kind: SessionKind } | null {
  switch (type) {
    case 'endurance_fondamentale': return { sport: 'course', kind: 'endurance' }
    case 'sortie_longue': return { sport: 'course', kind: 'sortie_longue' }
    case 'seuil': case 'allure_specifique': return { sport: 'course', kind: 'seuil' }
    case 'fractionne': return { sport: 'course', kind: 'fractionne' }
    case 'recuperation': return { sport: 'course', kind: 'recuperation' }
    case 'trail_denivele': return { sport: 'course', kind: 'trail' }
    case 'renforcement': return { sport: 'renfo', kind: 'force' }
    case 'mobilite': return { sport: 'renfo', kind: 'renfo_leger' }
    default: return null
  }
}
