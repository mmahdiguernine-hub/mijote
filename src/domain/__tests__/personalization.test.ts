import { describe, it, expect } from 'vitest'
import { checkRecipe } from '../constraints'
import { scaleRecipe } from '../scaling'
import { applyVariant, adaptToProfile } from '../variants'
import { analyzeRecipe } from '../analysis'
import { suggestRecipes } from '../scoring'
import { generatePlan, moveEntry, weekDates } from '../planner'
import { parseQuery } from '../search'
import { consumeRecipe } from '../pantry'
import { toBase } from '../units'
import { catalog, recipe, profile, ING } from './fixtures'

describe('adaptation aux portions', () => {
  it('met a l echelle proportionnellement', () => {
    const r = scaleRecipe(recipe('riz-poulet'), 5)
    expect(r.ingredients.find((l) => l.ingredientId === 'riz')!.quantity).toBe(250)
    expect(r.ingredients.find((l) => l.ingredientId === 'blanc_poulet')!.quantity).toBe(625)
  })

  it('ne met pas a l echelle les quantites "selon le gout"', () => {
    const r = scaleRecipe(recipe('riz-poulet'), 8)
    expect(r.ingredients.find((l) => l.ingredientId === 'sel')!.quantity).toBeNull()
    expect(r.scaleWarnings.length).toBeGreaterThan(0)
  })

  it('arrondit les oeufs a l unite superieure et le signale', () => {
    const r = scaleRecipe(recipe('riz-oeuf'), 3) // 3 oeufs pour 4 -> 2,25
    const oeuf = r.ingredients.find((l) => l.ingredientId === 'oeuf')!
    expect(oeuf.quantity).toBe(3)
    expect(oeuf.note).toContain('arrondie')
  })

  it('refuse un nombre de portions invalide', () => {
    expect(() => scaleRecipe(recipe('riz-poulet'), 0)).toThrow()
  })
})

describe('conversions d unites', () => {
  const by = (id: string) => ING.find((i) => i.id === id)!
  it('cl, cuilleres, pieces', () => {
    expect(toBase(20, 'cl', by('creme'))).toBe(200)
    expect(toBase(1, 'cas', by('huile'))).toBe(15)
    expect(toBase(2, 'piece', by('courgette'))).toBe(500)
    expect(toBase(1, 'kg', by('riz'))).toBe(1000)
  })
  it('refuse une conversion qui demanderait d inventer une donnee', () => {
    expect(toBase(2, 'piece', by('riz'))).toBeNull()
    expect(toBase(1, 'cas', by('riz'))).toBeNull() // pas de densite connue
  })
})

describe('allergies et exclusions : contraintes strictes', () => {
  it('bloque une recette contenant un allergene declare', () => {
    const c = checkRecipe(recipe('satay'), profile({ allergens: ['arachides'] }), catalog)
    expect(c.allowed).toBe(false)
    expect(c.violations[0].kind).toBe('allergene')
  })

  it('un allergene porte par un ingredient optionnel : recette possible en l omettant', () => {
    const c = checkRecipe(recipe('tofu-courgette'), profile({ allergens: ['arachides'] }), catalog)
    expect(c.allowed).toBe(true)
    expect(c.omit).toEqual(['cacahuete'])
  })

  it('bloque un ingredient exclu', () => {
    expect(checkRecipe(recipe('riz-courgette'), profile({ excludedIngredients: ['courgette'] }), catalog).allowed).toBe(false)
  })

  it('les suggestions ne contiennent jamais d allergene ni d exclusion', () => {
    const p = profile({ allergens: ['arachides', 'oeufs'], excludedIngredients: ['courgette'] })
    const results = suggestRecipes({ profile: p, catalog }, { limit: 50 })
    expect(results.length).toBeGreaterThan(0)
    for (const s of results) {
      const ids = s.recipe.ingredients.map((l) => l.ingredientId)
      expect(ids).not.toContain('cacahuete')
      expect(ids).not.toContain('oeuf')
      expect(ids).not.toContain('courgette')
    }
  })

  it('le planning automatique respecte le regime vegetarien', () => {
    const p = profile({ diet: 'vegetarien' })
    const { entries } = generatePlan({ profile: p, catalog, dates: ['2026-10-19', '2026-10-20'], existing: [], seed: 3, idFactory: idGen() })
    for (const e of entries.filter((x) => x.kind === 'recette')) {
      const r = catalog.recipesById.get(e.recipeId!)!
      const adapted = e.variant ? applyVariant(r, e.variant, { catalog, profile: p }).recipe : r
      expect(checkRecipe(adapted, p, catalog).allowed).toBe(true)
    }
  })

  it('un gout ("je n aime pas") n est jamais un filtre, seulement un classement', () => {
    const results = suggestRecipes({ profile: profile({ dislikedIngredients: ['blanc_poulet'] }), catalog }, { limit: 50 })
    expect(results.some((s) => s.recipe.ingredients.some((l) => l.ingredientId === 'blanc_poulet'))).toBe(true)
    expect(results[0].recipe.ingredients.some((l) => l.ingredientId === 'blanc_poulet')).toBe(false)
  })
})

describe('moteur de variantes', () => {
  it('version vegetarienne : remplace la viande ET le bouillon, recalcule la nutrition', () => {
    const r = applyVariant(recipe('poulet-creme'), 'vegetarienne', { catalog })
    expect(r.changed).toBe(true)
    const ids = r.recipe.ingredients.map((l) => l.ingredientId)
    expect(ids).not.toContain('blanc_poulet')
    expect(ids).not.toContain('bouillon_volaille')
    expect(ids).toContain('tofu_ferme')
    expect(checkRecipe(r.recipe, profile({ diet: 'vegetarien' }), catalog).allowed).toBe(true)
    const before = analyzeRecipe(recipe('poulet-creme'), catalog)
    const after = analyzeRecipe(r.recipe, catalog)
    expect(after.nutrition.value.protein).not.toBe(before.nutrition.value.protein)
    expect(r.recipe.variant!.changes.some((c) => c.type === 'substitution')).toBe(true)
    expect(r.recipe.steps[0]).toContain('→ tofu ferme')
  })

  it('annote les etapes sur des mots entiers seulement', async () => {
    const { CATALOG } = await import('@/data/catalog')
    const r = applyVariant(CATALOG.recipesById.get('spaghetti-bolognaise')!, 'vegetarienne', { catalog: CATALOG })
    expect(r.recipe.steps[0]).toMatch(/^Hacher l’oignon/)
    expect(r.recipe.steps[1]).toContain('bœuf haché (→ lentilles vertes)')
  })

  it('signale quand aucune substitution fiable n existe au lieu d inventer', () => {
    const r = applyVariant(recipe('satay'), 'sans_allergenes', { catalog, profile: profile({ allergens: ['arachides'] }) })
    expect(r.recipe.variant?.warnings.length).toBeGreaterThan(0)
    expect(r.recipe.variant?.confidence).toBe('faible')
  })

  it('n adapte pas une recette au profil si la variante reste incompatible', () => {
    expect(adaptToProfile(recipe('satay'), profile({ allergens: ['arachides'] }), catalog)).toBeNull()
  })

  it('une variante qui ne change rien est signalee comme telle', () => {
    expect(applyVariant(recipe('riz-courgette'), 'vegetarienne', { catalog }).changed).toBe(false)
  })

  it('la substitution respecte les allergies du profil (pas de tofu si allergie au soja)', () => {
    const r = applyVariant(recipe('poulet-creme'), 'vegetarienne', { catalog, profile: profile({ allergens: ['soja'] }) })
    expect(r.recipe.ingredients.map((l) => l.ingredientId)).not.toContain('tofu_ferme')
  })
})

describe('planning', () => {
  const dates = weekDates('2026-10-21')

  it('weekDates renvoie le lundi au dimanche', () => {
    expect(dates[0]).toBe('2026-10-19')
    expect(dates[6]).toBe('2026-10-25')
  })

  it('remplit chaque creneau et ne repete pas une recette tant qu il y a des alternatives', () => {
    const { entries } = generatePlan({ profile: profile({ leftoversOk: false }), catalog, dates: dates.slice(0, 2), existing: [], seed: 1, idFactory: idGen() })
    expect(entries).toHaveLength(4)
    const ids = entries.map((e) => e.recipeId)
    expect(new Set(ids).size).toBe(4)
  })

  it('respecte les repas verrouilles et les repas a l exterieur', () => {
    const existing = [
      { id: 'x', date: dates[0], slot: 'dejeuner' as const, kind: 'exterieur' as const, servings: 2 },
      { id: 'l', date: dates[0], slot: 'diner' as const, kind: 'recette' as const, recipeId: 'crepes', servings: 2, locked: true },
    ]
    const { entries } = generatePlan({ profile: profile(), catalog, dates: [dates[0]], existing, seed: 1, idFactory: idGen() })
    expect(entries.find((e) => e.id === 'x')).toBeDefined()
    expect(entries.find((e) => e.id === 'l')!.recipeId).toBe('crepes')
    expect(entries).toHaveLength(2)
  })

  it('prevoit des restes pour le lendemain midi en mode batch', () => {
    const { entries } = generatePlan({ profile: profile({ cookingStyle: 'batch' }), catalog, dates: dates.slice(0, 2), existing: [], seed: 1, idFactory: idGen() })
    const leftover = entries.find((e) => e.kind === 'reste')
    expect(leftover).toBeDefined()
    const source = entries.find((e) => e.id === leftover!.leftoverOf)!
    expect(source.servings).toBe(4)
    expect(source.leftoverServings).toBe(2)
  })

  it('un reste deplace avant son repas d origine est supprime', () => {
    const plan = [
      { id: 'a', date: '2026-10-20', slot: 'diner' as const, kind: 'recette' as const, recipeId: 'poulet-creme', servings: 4, leftoverServings: 2 },
      { id: 'b', date: '2026-10-21', slot: 'dejeuner' as const, kind: 'reste' as const, recipeId: 'poulet-creme', leftoverOf: 'a', servings: 2 },
    ]
    const moved = moveEntry(plan, 'b', '2026-10-19', 'dejeuner')
    expect(moved.find((e) => e.id === 'b')).toBeUndefined()
    expect(moved.find((e) => e.id === 'a')!.servings).toBe(2)
  })

  it('meme graine = meme menu (reproductible)', () => {
    const a = generatePlan({ profile: profile(), catalog, dates, existing: [], seed: 42, idFactory: idGen() })
    const b = generatePlan({ profile: profile(), catalog, dates, existing: [], seed: 42, idFactory: idGen() })
    expect(a.entries.map((e) => e.recipeId)).toEqual(b.entries.map((e) => e.recipeId))
  })
})

describe('recherche en langage naturel', () => {
  it('"j ai des courgettes et du poulet" -> ingredients reconnus', () => {
    expect(parseQuery("J'ai des courgettes et du poulet dans mon frigo", catalog).ingredients.sort()).toEqual(['blanc_poulet', 'courgette'])
  })
  it('"un repas sain en moins de 20 minutes"', () => {
    const f = parseQuery('Je veux un repas sain en moins de 20 minutes', catalog)
    expect(f.maxMinutes).toBe(20)
    expect(f.healthy).toBe(true)
  })
  it('"riche en protéines pour moins de 3 € par personne"', () => {
    const f = parseQuery('Trouve-moi un plat riche en protéines pour moins de 3 € par personne', catalog)
    expect(f.minProtein).toBeGreaterThan(0)
    expect(f.maxCostPerServing).toBe(3)
  })
  it('"quelque chose de gourmand ce soir"', () => {
    const f = parseQuery('Je veux cuisiner quelque chose de gourmand ce soir', catalog)
    expect(f.indulgent).toBe(true)
    expect(f.slot).toBe('diner')
  })
  it('"que faire avec les restes"', () => {
    expect(parseQuery('Que puis-je faire avec les restes de la veille ?', catalog).leftovers).toBe(true)
  })
})

describe('stock', () => {
  it('cuisiner une recette deduit les quantites du stock, en commencant par ce qui perime', () => {
    const pantry = [
      { id: 'a', ingredientId: 'riz', quantity: 80, unit: 'g' as const, expiresOn: '2026-10-20', addedOn: '2026-10-01', source: 'manuel' as const },
      { id: 'b', ingredientId: 'riz', quantity: 500, unit: 'g' as const, addedOn: '2026-10-01', source: 'manuel' as const },
      { id: 'c', ingredientId: 'blanc_poulet', quantity: null, unit: 'g' as const, addedOn: '2026-10-01', source: 'manuel' as const },
    ]
    const out = consumeRecipe(pantry, recipe('riz-poulet'), 2, catalog)
    expect(out.find((p) => p.id === 'a')).toBeUndefined()
    expect(out.find((p) => p.id === 'b')!.quantity).toBe(480)
    expect(out.find((p) => p.id === 'c')).toBeDefined()
  })
})

function idGen() {
  let n = 0
  return () => `id${n++}`
}
