import { describe, it, expect } from 'vitest'
import { basalMetabolism, classifyDay, dayNutrition, mealFocus, sessionKcal, mapPeakmindType } from '../sport'
import type { SportProfile, TrainingSession } from '../types'

const runner: SportProfile = {
  enabled: true, weightKg: 70, heightCm: 178, ageYears: 30, sex: 'homme', dailyActivity: 'leger', bodyGoal: 'maintien',
  sports: ['course'], defaultTimeOfDay: 'soir',
}
const s = (over: Partial<TrainingSession>): TrainingSession => ({ id: 'x', date: '2026-10-20', sport: 'course', kind: 'endurance', durationMinutes: 45, source: 'manuel', ...over })

describe('depense et metabolisme', () => {
  it('Mifflin-St Jeor avec donnees completes', () => {
    // 10*70 + 6.25*178 - 5*30 + 5 = 1667.5
    expect(basalMetabolism(runner)).toEqual({ kcal: 1668, confidence: 'moyenne' })
  })
  it('fiabilite faible si taille, age ou sexe manquent', () => {
    expect(basalMetabolism({ ...runner, heightCm: undefined })?.confidence).toBe('faible')
    expect(basalMetabolism({ ...runner, weightKg: undefined })).toBeNull()
  })
  it('course : ~1 kcal/kg/km, denivele compte', () => {
    expect(sessionKcal(s({ distanceKm: 10 }), 70)).toBe(700)
    expect(sessionKcal(s({ kind: 'trail', distanceKm: 20, elevationM: 1000 }), 70)).toBe(2100)
  })
  it('sans distance : MET x poids x duree', () => {
    expect(sessionKcal(s({ kind: 'force', sport: 'renfo', durationMinutes: 60 }), 70)).toBe(350)
  })
})

describe('type de journee', () => {
  it('repos, footing, seuil, sortie longue, musculation', () => {
    expect(classifyDay([], '2026-10-20', [])).toBe('repos')
    expect(classifyDay([s({ durationMinutes: 30 })], '2026-10-20', [])).toBe('leger')
    expect(classifyDay([s({ durationMinutes: 50 })], '2026-10-20', [])).toBe('modere')
    expect(classifyDay([s({ kind: 'seuil', durationMinutes: 50 })], '2026-10-20', [])).toBe('intense')
    expect(classifyDay([s({ kind: 'sortie_longue', durationMinutes: 100 })], '2026-10-20', [])).toBe('long')
    expect(classifyDay([s({ kind: 'force', sport: 'renfo', durationMinutes: 60 })], '2026-10-20', [])).toBe('force')
  })
  it('recharge avant un semi ou plus, simple veille avant un 10 km', () => {
    const semi = [{ date: '2026-10-22', name: 'Semi', distanceKm: 21.1 }]
    expect(classifyDay([], '2026-10-20', semi)).toBe('recharge')
    expect(classifyDay([], '2026-10-21', semi)).toBe('recharge')
    expect(classifyDay([], '2026-10-22', semi)).toBe('course')
    const dix = [{ date: '2026-10-22', name: '10 km', distanceKm: 10 }]
    expect(classifyDay([], '2026-10-21', dix)).toBe('veille')
    expect(classifyDay([], '2026-10-20', dix)).toBe('repos')
  })
})

describe('reperes du jour', () => {
  it('glucides en g/kg selon la charge : plus haut un jour de sortie longue qu un jour de repos', () => {
    const rest = dayNutrition(runner, '2026-10-20', [], [])!
    const long = dayNutrition(runner, '2026-10-20', [s({ kind: 'sortie_longue', durationMinutes: 110, distanceKm: 20 })], [])!
    expect(rest.carbs).toEqual({ min: 210, max: 350 })
    expect(long.carbs).toEqual({ min: 490, max: 700 })
    expect(long.energy.min).toBeGreaterThan(rest.energy.max)
    expect(long.during).toEqual({ min: 30, max: 60 })
    expect(rest.during).toBeUndefined()
  })
  it('proteines : 1,2-1,6 g/kg en endurance, 1,6-2,0 avec musculation', () => {
    expect(dayNutrition(runner, '2026-10-20', [], [])!.protein).toEqual({ min: 85, max: 110 })
    expect(dayNutrition({ ...runner, sports: ['course', 'renfo'] }, '2026-10-20', [], [])!.protein).toEqual({ min: 110, max: 140 })
  })
  it('perte de poids : deficit les jours calmes, jamais les jours de grosse seance', () => {
    const lose = { ...runner, bodyGoal: 'perte' as const }
    const restKeep = dayNutrition(runner, '2026-10-20', [], [])!
    const restLose = dayNutrition(lose, '2026-10-20', [], [])!
    expect(restLose.energy.max).toBeLessThan(restKeep.energy.max)
    const longSession = [s({ kind: 'sortie_longue', durationMinutes: 110, distanceKm: 20 })]
    expect(dayNutrition(lose, '2026-10-20', longSession, [])!.energy).toEqual(dayNutrition(runner, '2026-10-20', longSession, [])!.energy)
  })
  it('les lipides restent entre 20 et 35 % de l energie', () => {
    const d = dayNutrition(runner, '2026-10-20', [s({ kind: 'seuil', durationMinutes: 60 })], [])!
    const mid = (d.energy.min + d.energy.max) / 2
    expect(d.fat.min * 9).toBeGreaterThanOrEqual(mid * 0.18)
    expect(d.fat.max * 9).toBeLessThanOrEqual(mid * 0.37)
  })
  it('sans poids : pas de repere chiffre (rien n est invente)', () => {
    expect(dayNutrition({ ...runner, weightKg: undefined }, '2026-10-20', [], [])).toBeNull()
  })
})

describe('repas autour des seances', () => {
  it('dejeuner avant une seance intense le soir : glucides', () => {
    const f = mealFocus(runner, '2026-10-20', 'dejeuner', [s({ kind: 'fractionne', durationMinutes: 60, timeOfDay: 'soir' })], [])
    expect(f?.carbs).toBe('haut')
  })
  it('diner apres la seance du soir : proteines de recuperation', () => {
    const f = mealFocus(runner, '2026-10-20', 'diner', [s({ kind: 'seuil', durationMinutes: 60, timeOfDay: 'soir' })], [])
    expect(f?.minProtein).toBe(20)
  })
  it('diner de la veille d une sortie longue le matin : glucides', () => {
    const f = mealFocus(runner, '2026-10-19', 'diner', [s({ kind: 'sortie_longue', durationMinutes: 120, timeOfDay: 'matin' })], [])
    expect(f?.carbs).toBe('haut')
  })
  it('veille de course : diner digeste et riche en glucides', () => {
    const f = mealFocus(runner, '2026-10-21', 'diner', [], [{ date: '2026-10-22', name: '10 km', distanceKm: 10 }])
    expect(f).toMatchObject({ carbs: 'haut', light: true })
  })
  it('rien de particulier un jour de repos', () => {
    expect(mealFocus(runner, '2026-10-20', 'dejeuner', [], [])).toBeNull()
  })
})

describe('import PeakMind', () => {
  it('convertit et valide les seances et courses, ignore le repos et les donnees invalides', async () => {
    const { parsePeakmindExport } = await import('../peakmind')
    const r = parsePeakmindExport({
      version: 1,
      sessions: [
        { date: '2026-10-20', type: 'seuil', duration_minutes: 55, distance_km: 11 },
        { date: '2026-10-21', type: 'repos', duration_minutes: 0 },
        { date: 'demain', type: 'seuil', duration_minutes: 50 },
        { date: '2026-10-22', type: 'renforcement', duration_minutes: 30 },
      ],
      races: [{ id: 7, name: 'Semi', race_date: '2026-11-08', distance_km: 21.1, target_time_seconds: 6300 }, { id: 8, name: 'X', race_date: '2026-11-09', distance_km: -3 }],
    }, 'soir')
    expect(r.sessions.map((s) => s.kind)).toEqual(['seuil', 'force'])
    expect(r.sessions[0]).toMatchObject({ source: 'peakmind', timeOfDay: 'soir', distanceKm: 11 })
    expect(r.races).toEqual([{ id: 'pm-race-7', name: 'Semi', date: '2026-11-08', distanceKm: 21.1, elevationM: undefined, targetMinutes: 105, source: 'peakmind' }])
    expect(r.skipped).toBe(2)
  })
  it('refuse une version inconnue', async () => {
    const { parsePeakmindExport } = await import('../peakmind')
    expect(() => parsePeakmindExport({ version: 2 }, 'soir')).toThrow()
  })
})

describe('lien PeakMind', () => {
  it('convertit les types de seance PeakMind', () => {
    expect(mapPeakmindType('allure_specifique')).toEqual({ sport: 'course', kind: 'seuil' })
    expect(mapPeakmindType('renforcement')).toEqual({ sport: 'renfo', kind: 'force' })
    expect(mapPeakmindType('repos')).toBeNull()
  })
})
