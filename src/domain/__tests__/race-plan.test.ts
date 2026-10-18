import { describe, it, expect } from 'vitest'
import { buildRacePlan, raceFueling, estimateRaceMinutes } from '../race-plan'
import { CATALOG } from '@/data/catalog'
import { checkRecipe } from '../constraints'
import type { Profile, SportProfile } from '../types'

const sport: SportProfile = { enabled: true, weightKg: 70, heightCm: 178, ageYears: 30, sex: 'homme', dailyActivity: 'leger', bodyGoal: 'maintien', sports: ['course'], defaultTimeOfDay: 'matin' }
const profile: Profile = {
  diet: 'omnivore', allergens: [], excludedIngredients: [], dislikedIngredients: [], likedIngredients: [], goals: [], householdSize: 1,
  maxMinutesWeekday: 45, maxMinutesWeekend: 90, skill: 2, equipment: ['plaque', 'four', 'mixeur'], discovery: 0.3, preferSeasonal: false,
  cookingStyle: 'mixte', leftoversOk: true, slots: ['dejeuner', 'diner'], onboardingDone: true, sport,
}

describe('ravitaillement', () => {
  it('10 km en 50 min : pas de gels', () => {
    const f = raceFueling({ date: '2026-11-08', name: '10 km', distanceKm: 10, targetMinutes: 50 })
    expect(f.carbsPerHour).toBeNull()
    expect(f.gels).toBeNull()
  })
  it('semi en 1 h 45 : 30-60 g/h, environ 1 a 3 gels', () => {
    const f = raceFueling({ date: '2026-11-08', name: 'Semi', distanceKm: 21.1, targetMinutes: 105 })
    expect(f.carbsPerHour).toEqual({ min: 30, max: 60 })
    expect(f.totalCarbs).toEqual({ min: 40, max: 75 })
    expect(f.gels).toEqual({ min: 2, max: 3 })
    expect(f.schedule.length).toBeGreaterThanOrEqual(2)
    expect(f.sodiumMgPerHour).toBeNull()
  })
  it('marathon en 3 h 45 : 60-90 g/h, sodium, pas encore de solide', () => {
    const f = raceFueling({ date: '2026-11-08', name: 'Marathon', distanceKm: 42.2, targetMinutes: 225 })
    expect(f.carbsPerHour).toEqual({ min: 60, max: 90 })
    expect(f.sodiumMgPerHour).not.toBeNull()
    expect(f.solids).toBe(false)
  })
  it('trail long : aliments solides au programme', () => {
    const f = raceFueling({ date: '2026-11-08', name: 'Trail', distanceKm: 45, elevationM: 2000, targetMinutes: 420 })
    expect(f.solids).toBe(true)
    expect(f.schedule.some((s) => s.action.includes('solide'))).toBe(true)
  })
  it('sans temps vise : duree estimee et signalee comme telle', () => {
    expect(estimateRaceMinutes({ date: '2026-11-08', name: 'Trail', distanceKm: 20, elevationM: 1000 })).toEqual({ minutes: 220, estimated: true })
  })
})

describe('planning oriente sport', () => {
  it('sortie longue samedi matin : le diner du vendredi est riche en glucides, pas avant sans profil sport', async () => {
    const { generatePlan } = await import('../planner')
    const { analyzeRecipe } = await import('../analysis')
    const sessions = [{ id: 's', date: '2026-10-24', sport: 'course' as const, kind: 'sortie_longue' as const, durationMinutes: 120, distanceKm: 20, timeOfDay: 'matin' as const, source: 'manuel' as const }]
    const carbsOfFridayDinner = (p: Profile) => {
      const { entries } = generatePlan({ profile: p, catalog: CATALOG, dates: ['2026-10-23'], existing: [], seed: 4, sessions, idFactory: (() => { let n = 0; return () => `e${n++}` })() })
      const dinner = entries.find((e) => e.slot === 'diner')!
      return analyzeRecipe(CATALOG.recipesById.get(dinner.recipeId!)!, CATALOG).nutrition.value.carbs
    }
    expect(carbsOfFridayDinner({ ...profile, leftoversOk: false })).toBeGreaterThanOrEqual(70)
  })
})

describe('plan de la semaine de course', () => {
  it('semi : recharge J-2 et veille, jour J, J+1, avec idees de repas compatibles', async () => {
    const plan = buildRacePlan({ profile, sport, race: { date: '2026-11-08', name: 'Semi', distanceKm: 21.1, targetMinutes: 105 }, sessions: [], catalog: CATALOG, today: '2026-11-01' })
    expect(plan.days.map((d) => d.label)).toEqual(['J-6', 'J-5', 'J-4', 'J-3', 'J-2', 'Veille', 'Jour J', 'J+1'])
    const j2 = plan.days.find((d) => d.label === 'J-2')!
    expect(j2.nutrition?.dayType).toBe('recharge')
    expect(j2.nutrition!.carbs.min).toBeGreaterThan(plan.days[0].nutrition!.carbs.max)
    expect(plan.days.find((d) => d.label === 'Veille')!.ideas.length).toBeGreaterThan(0)
    // Recharge : pas de plats riches en fibres (legumineuses) la veille et l'avant-veille
    const { analyzeRecipe } = await import('../analysis')
    for (const d of plan.days.filter((x) => x.label === 'J-2' || x.label === 'Veille')) {
      for (const r of d.ideas) expect(analyzeRecipe(r, CATALOG).nutrition.value.fiber, r.id).toBeLessThanOrEqual(10)
    }
    expect(plan.breakfast.carbs).toEqual({ min: 105, max: 175 })
    expect(plan.breakfast.ideas.map((r) => r.id)).toContain('petit-dej-avant-course')
  })
  it('les idees de repas respectent les allergies', () => {
    const allergic = { ...profile, allergens: ['gluten' as const] }
    const plan = buildRacePlan({ profile: allergic, sport, race: { date: '2026-11-08', name: 'Semi', distanceKm: 21.1 }, sessions: [], catalog: CATALOG, today: '2026-11-01' })
    for (const d of plan.days) for (const r of d.ideas) expect(checkRecipe(r, allergic, CATALOG).allowed, r.id).toBe(true)
  })
  it('commence aujourd hui si la course est dans moins d une semaine', () => {
    const plan = buildRacePlan({ profile, sport, race: { date: '2026-11-08', name: '10 km', distanceKm: 10 }, sessions: [], catalog: CATALOG, today: '2026-11-06' })
    expect(plan.days[0].label).toBe('J-2')
  })
})
