import { describe, it, expect } from 'vitest'
import { buildShoppingList, choosePackages, mealsFromPlan, missingIngredients } from '../shopping'
import { replaceRecipe, removeEntry } from '../planner'
import { analyzeRecipe } from '../analysis'
import type { PlanEntry } from '../types'
import { catalog, recipe, profile } from './fixtures'

const opts = { catalog, usePackages: false }
const line = (list: ReturnType<typeof buildShoppingList>, id: string) => list.lines.find((l) => l.ingredientId === id)!

describe('agregation des ingredients', () => {
  it('additionne les ingredients identiques en une seule ligne (100 + 150 + 200 g de riz = 450 g)', () => {
    const list = buildShoppingList([
      { recipe: recipe('riz-poulet'), servings: 2 },
      { recipe: recipe('riz-courgette'), servings: 2 },
      { recipe: recipe('riz-oeuf'), servings: 4 },
    ], opts)
    const riz = list.lines.filter((l) => l.ingredientId === 'riz')
    expect(riz).toHaveLength(1)
    expect(riz[0].needed).toBe(450)
    expect(riz[0].toBuy).toBe(450)
    expect(riz[0].sources.map((s) => s.recipeId)).toEqual(['riz-poulet', 'riz-courgette', 'riz-oeuf'])
  })

  it('ajuste les quantites au nombre de portions avant d additionner', () => {
    // riz-poulet est pour 2 : pour 6 personnes, x3
    const list = buildShoppingList([{ recipe: recipe('riz-poulet'), servings: 6 }, { recipe: recipe('riz-oeuf'), servings: 2 }], opts)
    expect(line(list, 'riz').needed).toBe(300 + 100)
    expect(line(list, 'blanc_poulet').needed).toBe(750)
  })

  it('convertit les unites avant d additionner (20 cl + 100 ml de creme)', () => {
    const list = buildShoppingList([{ recipe: recipe('poulet-creme'), servings: 2 }], { ...opts, manual: [{ id: 'm1', ingredientId: 'creme', label: 'Crème', quantity: 100, unit: 'ml', aisle: 'cremerie', recurring: false, checked: false }] })
    expect(line(list, 'creme').needed).toBe(300)
  })

  it('pieces -> grammes via le poids moyen (2 courgettes + 300 g)', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-courgette'), servings: 2 }, { recipe: recipe('tofu-courgette'), servings: 2 }], opts)
    expect(line(list, 'courgette').needed).toBe(800)
  })

  it('les ingredients "selon le gout" ne sont jamais additionnes ni a acheter', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-poulet'), servings: 2 }], opts)
    const sel = line(list, 'sel')
    expect(sel.toTaste).toBe(true)
    expect(sel.toBuy).toBe(0)
    expect(list.covered.some((l) => l.ingredientId === 'sel')).toBe(true)
  })

  it('les produits de placard sont a verifier, pas a acheter', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-courgette'), servings: 2 }], opts)
    expect(line(list, 'huile').staple).toBe(true)
    expect(list.byAisle.flatMap((g) => g.lines).some((l) => l.ingredientId === 'huile')).toBe(false)
  })

  it('les ingredients optionnels ne sont pas ajoutes a la liste', () => {
    const list = buildShoppingList([{ recipe: recipe('tofu-courgette'), servings: 2 }], opts)
    expect(list.lines.some((l) => l.ingredientId === 'cacahuete')).toBe(false)
  })

  it('regroupe par rayon dans l ordre du magasin', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-poulet'), servings: 2 }, { recipe: recipe('riz-courgette'), servings: 2 }], opts)
    expect(list.byAisle.map((g) => g.aisle)).toEqual(['fruits_legumes', 'boucherie_poisson', 'epicerie_salee'])
  })
})

describe('prise en compte du stock', () => {
  it('deduit les quantites connues du stock', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-poulet'), servings: 2 }, { recipe: recipe('riz-courgette'), servings: 2 }], {
      ...opts, pantry: [{ id: 'p1', ingredientId: 'riz', quantity: 200, unit: 'g', addedOn: '2026-10-01', source: 'manuel' }],
    })
    const riz = line(list, 'riz')
    expect(riz.fromPantry).toBe(200)
    expect(riz.toBuy).toBe(50)
  })

  it('un stock suffisant fait passer la ligne dans "deja chez toi"', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-poulet'), servings: 2 }], {
      ...opts, pantry: [{ id: 'p1', ingredientId: 'riz', quantity: 1, unit: 'kg', addedOn: '2026-10-01', source: 'manuel' }],
    })
    expect(line(list, 'riz').toBuy).toBe(0)
    expect(list.covered.some((l) => l.ingredientId === 'riz')).toBe(true)
  })

  it('quantite inconnue en stock : supposee suffisante mais signalee a verifier', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-poulet'), servings: 2 }], {
      ...opts, pantry: [{ id: 'p1', ingredientId: 'riz', quantity: null, unit: 'g', addedOn: '2026-10-01', source: 'manuel' }],
    })
    expect(line(list, 'riz').stockUnknown).toBe(true)
    expect(line(list, 'riz').toBuy).toBe(0)
  })

  it('ignore le stock perime, et celui qui sera perime avant le repas', () => {
    const list = buildShoppingList([{ recipe: recipe('poulet-creme'), servings: 2, date: '2026-10-20' }], {
      ...opts,
      today: '2026-10-17',
      pantry: [
        { id: 'p1', ingredientId: 'blanc_poulet', quantity: 300, unit: 'g', expiresOn: '2026-10-16', addedOn: '2026-10-10', source: 'manuel' },
        { id: 'p2', ingredientId: 'creme', quantity: 200, unit: 'ml', expiresOn: '2026-10-18', addedOn: '2026-10-10', source: 'manuel' },
      ],
    })
    expect(line(list, 'blanc_poulet').toBuy).toBe(300)
    expect(line(list, 'creme').toBuy).toBe(200)
    expect(list.warnings.length).toBe(2)
  })

  it('un produit ne couvre que les repas prevus avant sa peremption', () => {
    // 500 g de courgettes perimant le 19 : couvrent le repas du 19 (500 g) mais pas celui du 24 (300 g)
    const list = buildShoppingList([
      { recipe: recipe('riz-courgette'), servings: 2, date: '2026-10-24' },
      { recipe: recipe('tofu-courgette'), servings: 2, date: '2026-10-19' },
    ], {
      ...opts, today: '2026-10-17',
      pantry: [{ id: 'p', ingredientId: 'courgette', quantity: 500, unit: 'g', expiresOn: '2026-10-19', addedOn: '2026-10-15', source: 'manuel' }],
    })
    const c = line(list, 'courgette')
    expect(c.needed).toBe(800)
    expect(c.fromPantry).toBe(300)
    expect(c.toBuy).toBe(500)
    expect(list.warnings.some((w) => w.includes('Courgette'))).toBe(true)
  })

  it('calcule les ingredients manquants pour cuisiner une recette maintenant', () => {
    const missing = missingIngredients(recipe('riz-poulet'), 2, [{ id: 'p1', ingredientId: 'riz', quantity: 500, unit: 'g', addedOn: '2026-10-01', source: 'manuel' }], catalog)
    expect(missing.map((l) => l.ingredientId)).toEqual(['blanc_poulet'])
    expect(missing[0].toBuy).toBe(250)
  })
})

describe('conditionnements', () => {
  it('choisit le paquet qui couvre le besoin avec le moins de perte', () => {
    expect(choosePackages(450, [500, 1000])).toEqual({ packs: [{ size: 500, count: 1 }], total: 500, leftover: 50 })
    expect(choosePackages(1200, [500, 1000])?.total).toBe(1500)
    expect(choosePackages(1200, [500, 1000])?.packs.reduce((s, p) => s + p.count, 0)).toBe(2)
    expect(choosePackages(7, [6, 12])).toEqual({ packs: [{ size: 12, count: 1 }], total: 12, leftover: 5 })
    expect(choosePackages(0, [500])).toBeNull()
  })

  it('arrondit l achat aux conditionnements et signale le reste', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-oeuf'), servings: 4 }], { catalog })
    const oeuf = line(list, 'oeuf')
    expect(oeuf.toBuy).toBe(3)
    expect(oeuf.purchase).toEqual({ packs: [{ size: 6, count: 1 }], total: 6, leftover: 3 })
  })
})

describe('budget', () => {
  it('le cout total est la somme des lignes, calcule sur la quantite achetee', () => {
    const list = buildShoppingList([{ recipe: recipe('riz-poulet'), servings: 2 }], { catalog })
    // riz : paquet de 500 g a 2 €/kg = 1 € ; poulet : barquette de 300 g a 14 €/kg = 4,20 €
    expect(line(list, 'riz').estimatedCost).toBe(1)
    expect(line(list, 'blanc_poulet').estimatedCost).toBe(4.2)
    expect(list.cost.value).toBe(5.2)
  })

  it('le cout d une recette (analysis) est coherent avec les quantites exactes', () => {
    const a = analyzeRecipe(recipe('riz-poulet'), catalog)
    // 100 g riz = 0,20 € + 250 g poulet = 3,50 €
    expect(a.cost.value).toBe(3.7)
    expect(a.costPerServing.value).toBe(1.85)
    expect(a.cost.coverage).toBe(1)
  })

  it('signale une couverture partielle quand un prix manque', () => {
    const a = analyzeRecipe(recipe('crepes'), catalog)
    expect(a.cost.coverage).toBeLessThan(1)
    expect(a.cost.confidence).toBe('faible')
  })
})

describe('synchronisation avec le planning', () => {
  const plan: PlanEntry[] = [
    { id: 'a', date: '2026-10-19', slot: 'diner', kind: 'recette', recipeId: 'riz-poulet', servings: 2 },
    { id: 'b', date: '2026-10-20', slot: 'diner', kind: 'recette', recipeId: 'riz-courgette', servings: 2 },
    { id: 'c', date: '2026-10-21', slot: 'dejeuner', kind: 'reste', leftoverOf: 'b', recipeId: 'riz-courgette', servings: 2 },
    { id: 'd', date: '2026-10-22', slot: 'diner', kind: 'exterieur', servings: 2 },
  ]
  const ctx = { catalog, profile: profile() }

  it('les restes et repas a l exterieur ne generent aucune course', () => {
    const { meals } = mealsFromPlan(plan, ctx)
    expect(meals.map((m) => m.entryId)).toEqual(['a', 'b'])
  })

  it('remplacer une recette met la liste a jour', () => {
    const before = buildShoppingList(mealsFromPlan(plan, ctx).meals, opts)
    expect(line(before, 'courgette')).toBeDefined()
    const updated = replaceRecipe(plan, 'b', recipe('riz-oeuf'), catalog)
    const after = buildShoppingList(mealsFromPlan(updated, ctx).meals, opts)
    expect(after.lines.some((l) => l.ingredientId === 'courgette')).toBe(false)
    expect(line(after, 'oeuf').needed).toBe(1.5)
    expect(line(after, 'riz').needed).toBe(100 + 100)
  })

  it('supprimer un repas retire ses ingredients (et ses restes)', () => {
    const updated = removeEntry(plan, 'b')
    expect(updated.some((e) => e.id === 'c')).toBe(false)
    const after = buildShoppingList(mealsFromPlan(updated, ctx).meals, opts)
    expect(line(after, 'riz').needed).toBe(100)
  })

  it('limite la liste a une periode', () => {
    const { meals } = mealsFromPlan(plan, ctx, { from: '2026-10-20', to: '2026-10-20' })
    expect(meals.map((m) => m.entryId)).toEqual(['b'])
  })

  it('conserve les actions de l utilisateur (cochee, retiree, quantite imposee) apres recalcul', () => {
    const overrides = [{ key: 'riz', checked: true }, { key: 'blanc_poulet', removed: true }, { key: 'courgette', quantityOverride: 1000 }]
    const list = buildShoppingList(mealsFromPlan(plan, ctx).meals, { ...opts, overrides })
    expect(line(list, 'riz').checked).toBe(true)
    expect(list.lines.some((l) => l.ingredientId === 'blanc_poulet')).toBe(false)
    expect(list.removed.map((l) => l.ingredientId)).toEqual(['blanc_poulet'])
    expect(line(list, 'courgette').toBuy).toBe(1000)
  })

  it('ajouts manuels libres : conserves tels quels', () => {
    const list = buildShoppingList([], { ...opts, manual: [{ id: 'm', label: 'Papier toilette', quantity: 1, unit: 'piece', aisle: 'autre', recurring: true, checked: false }] })
    expect(list.byAisle[0].lines[0].label).toBe('Papier toilette')
    expect(list.byAisle[0].lines[0].recurring).toBe(true)
  })
})
