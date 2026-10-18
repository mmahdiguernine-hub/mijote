import { describe, it, expect } from 'vitest'
import { proposeBatch, storageFor, batchTimeline } from '../batch'
import { CATALOG } from '@/data/catalog'
import { checkRecipe } from '../constraints'
import { buildShoppingList, mealsFromPlan } from '../shopping'
import { addDays } from '../shopping'
import type { Profile } from '../types'

const profile: Profile = {
  diet: 'omnivore', allergens: ['arachides'], excludedIngredients: [], dislikedIngredients: [], likedIngredients: [], goals: [], householdSize: 2,
  maxMinutesWeekday: 45, maxMinutesWeekend: 120, skill: 2, equipment: ['plaque', 'four', 'mixeur', 'micro_ondes'], discovery: 0.3, preferSeasonal: false,
  cookingStyle: 'batch', leftoversOk: true, slots: ['dejeuner', 'diner'], onboardingDone: true,
}
const cookDate = '2026-10-25' // dimanche
const dates = [cookDate, ...[1, 2, 3, 4].map((d) => addDays(cookDate, d))]
let i = 0
const ids = () => `id${i++}`

describe('batch cooking', () => {
  const p = proposeBatch({ profile, catalog: CATALOG, cookDate, dates, existing: [], seed: 3, idFactory: ids })

  it('couvre tous les repas libres (sauf le midi du jour de preparation) avec 2 a 4 plats', () => {
    expect(p.entries).toHaveLength(9) // dimanche soir + 4 jours x 2
    expect(p.recipes.length).toBeGreaterThanOrEqual(2)
    expect(p.recipes.length).toBeLessThanOrEqual(4)
    expect(p.entries.every((e) => e.cookOn === cookDate && e.batchId === p.session.id)).toBe(true)
  })

  it('une seule entree cuisinee par plat, les autres sont des restes avec les bonnes portions', () => {
    for (const r of p.recipes) {
      const cooked = p.entries.filter((e) => e.recipeId === r.baseId && e.kind === 'recette')
      const rest = p.entries.filter((e) => e.recipeId === r.baseId && e.kind === 'reste')
      expect(cooked).toHaveLength(1)
      expect(cooked[0].servings).toBe(2 * r.meals)
      expect(rest.every((e) => e.leftoverOf === cooked[0].id)).toBe(true)
    }
  })

  it('respecte la conservation : au-dela du frigo, uniquement un plat congelable (a congeler)', () => {
    for (const e of p.entries) {
      const r = CATALOG.recipesById.get(e.recipeId!)!
      const days = Math.round((Date.parse(e.date) - Date.parse(cookDate)) / 86400000)
      expect(storageFor(r, days), `${r.id} le ${e.date}`).not.toBeNull()
    }
    for (const s of p.storage) {
      for (const d of s.freezeFor) expect(d > s.fridgeUntil).toBe(true)
    }
  })

  it('ne propose que des plats compatibles et varies', () => {
    for (const r of p.recipes) expect(checkRecipe(r.recipe, profile, CATALOG).allowed).toBe(true)
    expect(new Set(p.recipes.map((r) => r.baseId)).size).toBe(p.recipes.length)
  })

  it('ne touche pas aux repas deja prevus', () => {
    const existing = [{ id: 'x', date: addDays(cookDate, 1), slot: 'diner' as const, kind: 'exterieur' as const, servings: 2 }]
    const q = proposeBatch({ profile, catalog: CATALOG, cookDate, dates, existing, seed: 3, idFactory: ids })
    expect(q.entries.some((e) => e.date === addDays(cookDate, 1) && e.slot === 'diner')).toBe(false)
    expect(q.entries).toHaveLength(8)
  })

  it('les courses sont rattachees au jour de preparation et additionnees', () => {
    const { meals } = mealsFromPlan(p.entries, { catalog: CATALOG, profile }, { from: cookDate, to: cookDate })
    expect(meals.length).toBe(p.recipes.length)
    const list = buildShoppingList(meals, { catalog: CATALOG, today: '2026-10-24' })
    expect(list.byAisle.length).toBeGreaterThan(1)
  })

  it('deroule : le plat le plus long demarre en premier, le temps total couvre les cuissons', () => {
    expect(p.timeline[0].recipeId).toBe([...p.recipes].sort((a, b) => b.recipe.cookMinutes - a.recipe.cookMinutes)[0].baseId)
    expect(p.totalMinutes).toBeGreaterThanOrEqual(Math.max(...p.recipes.map((r) => r.recipe.cookMinutes)))
    expect(p.activeMinutes).toBeLessThan(p.recipes.reduce((s, r) => s + r.recipe.prepMinutes + r.recipe.cookMinutes, 0) + 60)
  })

  it('timeline : les cuissons passives se chevauchent', () => {
    const a = CATALOG.recipesById.get('chili-con-carne')!
    const b = CATALOG.recipesById.get('dahl-lentilles-corail')!
    const t = batchTimeline([{ recipe: a, baseId: a.id, factor: 1 }, { recipe: b, baseId: b.id, factor: 1 }])
    const sequential = a.prepMinutes + a.cookMinutes + b.prepMinutes + b.cookMinutes
    expect(t.totalMinutes).toBeLessThan(sequential)
  })
})
