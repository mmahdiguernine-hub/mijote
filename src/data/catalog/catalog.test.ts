import { describe, it, expect } from 'vitest'
import { CATALOG, INGREDIENTS, RECIPES } from './index'
import { toBase } from '@/domain/units'
import { analyzeRecipe } from '@/domain/analysis'
import { generatePlan, weekDates } from '@/domain/planner'
import { buildShoppingList, mealsFromPlan } from '@/domain/shopping'
import { checkRecipe } from '@/domain/constraints'
import { availableVariants } from '@/domain/variants'
import type { Profile } from '@/domain/types'

// Garde-fous sur les donnees : une faute de frappe dans un identifiant ou une unite impossible a
// convertir fausserait silencieusement les listes de courses -- ces tests l'empechent.

describe('integrite du catalogue', () => {
  it('identifiants uniques', () => {
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length)
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length)
  })

  it('chaque ingredient de recette existe et chaque quantite est convertible', () => {
    const problems: string[] = []
    for (const r of RECIPES) {
      for (const l of r.ingredients) {
        const ing = CATALOG.ingredients.get(l.ingredientId)
        if (!ing) { problems.push(`${r.id}: ingredient inconnu ${l.ingredientId}`); continue }
        if (l.quantity != null && toBase(l.quantity, l.unit, ing) == null) problems.push(`${r.id}: ${l.quantity} ${l.unit} de ${ing.id} non convertible`)
      }
    }
    expect(problems).toEqual([])
  })

  it('chaque recette a des etapes, des portions et une nutrition estimable', () => {
    for (const r of RECIPES) {
      expect(r.steps.length, r.id).toBeGreaterThan(0)
      expect(r.servings, r.id).toBeGreaterThan(0)
      const a = analyzeRecipe(r, CATALOG, 10)
      expect(a.nutrition.coverage, r.id).toBeGreaterThanOrEqual(0.9)
      expect(a.cost.coverage, r.id).toBeGreaterThanOrEqual(0.9)
      expect(a.nutrition.value.kcal, r.id).toBeGreaterThan(50)
      expect(a.nutrition.value.kcal, r.id).toBeLessThan(1500)
    }
  })

  it('les substitutions et familles interchangeables pointent vers des ingredients existants', async () => {
    const { SUBSTITUTIONS, INTERCHANGEABLE } = await import('@/domain/variants')
    const missing = [
      ...SUBSTITUTIONS.flatMap((s) => [s.from, s.to]),
      ...INTERCHANGEABLE.flat(),
      'oeuf', 'pois_chiches', 'tofu_ferme', 'courgette', 'carotte', 'epinards_surgeles', 'brocoli', 'poivron', 'haricots_verts_surgeles', 'parmesan', 'emmental_rape', 'comte', 'chocolat_noir',
    ].filter((id) => !CATALOG.ingredients.has(id))
    expect([...new Set(missing)]).toEqual([])
  })

  it('les variantes vegetariennes produites sont vraiment vegetariennes', () => {
    const veg = { allergens: [], excludedIngredients: [], diet: 'vegetarien' as const, equipment: [] }
    for (const r of RECIPES) {
      for (const v of availableVariants(r, { catalog: CATALOG })) {
        if (v.kind !== 'vegetarienne' || v.result.recipe.variant!.warnings.length > 0) continue
        expect(checkRecipe(v.result.recipe, veg, CATALOG).allowed, r.id).toBe(true)
      }
    }
  })
})

describe('scenario complet sur le vrai catalogue', () => {
  const profile: Profile = {
    diet: 'flexitarien', allergens: ['arachides'], excludedIngredients: ['chorizo'], dislikedIngredients: [], likedIngredients: [],
    goals: [{ goal: 'petit_budget', intensity: 'modere' }], householdSize: 2, budget: { amount: 60, period: 'semaine' },
    maxMinutesWeekday: 40, maxMinutesWeekend: 120, skill: 2, equipment: ['plaque', 'four', 'mixeur'], discovery: 0.5,
    preferSeasonal: true, cookingStyle: 'mixte', leftoversOk: true, slots: ['dejeuner', 'diner'], onboardingDone: true,
  }

  it('genere une semaine complete, sans allergene, avec une liste de courses chiffree', () => {
    const dates = weekDates('2026-10-21')
    const { entries } = generatePlan({ profile, catalog: CATALOG, dates, existing: [], seed: 5, today: '2026-10-19' })
    expect(entries.filter((e) => e.date >= dates[0])).toHaveLength(14)
    const { meals } = mealsFromPlan(entries, { catalog: CATALOG, profile })
    for (const m of meals) {
      expect(m.recipe.ingredients.some((l) => l.ingredientId === 'beurre_cacahuete' || l.ingredientId === 'chorizo'), m.recipe.id).toBe(false)
    }
    // Variete : pas plus de 2 soupes cuisinees dans la semaine.
    const soups = entries.filter((e) => e.kind === 'recette' && CATALOG.recipesById.get(e.recipeId!)?.course === 'soupe')
    expect(soups.length).toBeLessThanOrEqual(2)
    const list = buildShoppingList(meals, { catalog: CATALOG, today: '2026-10-19' })
    expect(list.byAisle.length).toBeGreaterThan(2)
    expect(list.cost.value).toBeGreaterThan(10)
    expect(list.cost.value).toBeLessThan(150)
  })
})
