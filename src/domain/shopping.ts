import type {
  Aisle, BaseUnit, Ingredient, ManualShoppingItem, PantryItem, PlanEntry, Recipe, ShoppingOverride, Unit,
} from './types'
import { type Catalog, ingredientOf } from './catalog'
import { toBase } from './units'
import { resolveRecipe, type VariantContext } from './variants'

// Generation de la liste de courses. La liste n'est JAMAIS stockee telle quelle : elle est
// recalculee a partir du planning, du stock et des ajouts manuels. Seules les actions de
// l'utilisateur sur une ligne calculee (cochee, retiree, quantite imposee) sont conservees, sous
// forme d'overrides rattaches a l'ingredient. Consequence : changer une recette du planning met la
// liste a jour sans qu'aucun code n'ait a "penser" a la synchroniser.
//
// Etapes (dans l'ordre du cahier des charges) :
//  1. ingredients de chaque repas planifie, 2. mis a l'echelle des portions, 3. additionnes par
//  ingredient, 4-5. stock deduit, 6. regroupes par rayon, 7. arrondis aux conditionnements,
//  8. cout estime, 9. overrides et ajouts manuels appliques.

export type MealNeed = {
  entryId?: string
  date?: string
  recipe: Recipe
  servings: number
}

export type Purchase = {
  packs: { size: number; count: number }[]
  total: number
  /** Ce qui restera une fois les recettes faites (conditionnement plus grand que le besoin). */
  leftover: number
}

export type ShoppingSource = { entryId?: string; recipeId: string; recipeName: string; date?: string; amount: number }

export type ShoppingLine = {
  key: string
  ingredientId?: string
  label: string
  aisle: Aisle
  baseUnit?: BaseUnit
  /** Besoin total (baseUnit), avant stock. */
  needed: number
  /** Quantite deduite grace au stock connu. */
  fromPantry: number
  /** A acheter (baseUnit), apres stock et override eventuel. */
  toBuy: number
  purchase?: Purchase
  /** Quantites qu'on ne sait pas convertir sans inventer (affichees a part, jamais additionnees). */
  extra: { quantity: number; unit: Unit }[]
  /** Au moins une recette l'utilise "selon le gout". */
  toTaste: boolean
  /** En stock mais quantite inconnue : supposee suffisante, a verifier. */
  stockUnknown: boolean
  /** Produit de placard (sel, huile...) : a verifier plutot qu'a acheter. */
  staple: boolean
  estimatedCost: number | null
  sources: ShoppingSource[]
  manualIds: string[]
  recurring: boolean
  checked: boolean
  store?: string
  overridden: boolean
}

export type ShoppingList = {
  lines: ShoppingLine[]
  /** Lignes reellement a acheter, par rayon, dans l'ordre d'un parcours de magasin classique. */
  byAisle: { aisle: Aisle; lines: ShoppingLine[] }[]
  /** Lignes couvertes par le stock ou a verifier dans les placards. */
  covered: ShoppingLine[]
  removed: ShoppingLine[]
  cost: { value: number; pricedLines: number; totalLines: number }
  warnings: string[]
}

export const AISLE_ORDER: Aisle[] = [
  'fruits_legumes', 'boulangerie', 'boucherie_poisson', 'cremerie', 'epicerie_salee', 'epicerie_sucree', 'condiments', 'boissons', 'surgeles', 'autre',
]

export const AISLE_LABEL: Record<Aisle, string> = {
  fruits_legumes: 'Fruits et légumes', boulangerie: 'Boulangerie', boucherie_poisson: 'Viandes et poissons',
  cremerie: 'Crèmerie et frais', epicerie_salee: 'Épicerie salée', epicerie_sucree: 'Épicerie sucrée',
  condiments: 'Épices, sauces et huiles', boissons: 'Boissons', surgeles: 'Surgelés', autre: 'Autres',
}

const EPS = 1e-6

/**
 * Combinaison de conditionnements qui couvre `need` avec le moins de perte, puis le moins de
 * paquets. Ex. besoin 450 g, paquets [500, 1000] -> 1 x 500 g. Programmation dynamique sur des
 * quantites entieres (g, ml ou pieces).
 */
export function choosePackages(need: number, sizes: number[]): Purchase | null {
  const valid = [...new Set(sizes.filter((s) => s > 0).map((s) => Math.round(s)))].sort((a, b) => a - b)
  if (need <= EPS || valid.length === 0) return null
  const target = Math.ceil(need - EPS)
  const max = target + valid[valid.length - 1]
  // best[q] = nombre minimal de paquets pour atteindre exactement q, et choix associe
  const best = new Array<number>(max + 1).fill(Infinity)
  const pick = new Array<number>(max + 1).fill(-1)
  best[0] = 0
  for (let q = 1; q <= max; q++) {
    for (const s of valid) {
      if (s <= q && best[q - s] + 1 < best[q]) {
        best[q] = best[q - s] + 1
        pick[q] = s
      }
    }
  }
  for (let q = target; q <= max; q++) {
    if (best[q] === Infinity) continue
    const counts = new Map<number, number>()
    for (let r = q; r > 0; r -= pick[r]) counts.set(pick[r], (counts.get(pick[r]) ?? 0) + 1)
    const packs = [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([size, count]) => ({ size, count }))
    return { packs, total: q, leftover: Math.max(0, q - need) }
  }
  return null
}

/** Repas cuisines de la periode -> besoins. Les restes et repas a l'exterieur ne generent aucune course. */
export function mealsFromPlan(
  entries: PlanEntry[],
  ctx: VariantContext,
  range?: { from: string; to: string },
): { meals: MealNeed[]; missingRecipes: string[] } {
  const meals: MealNeed[] = []
  const missingRecipes: string[] = []
  for (const e of entries) {
    if (e.kind !== 'recette' || !e.recipeId) continue
    if (range && (e.date < range.from || e.date > range.to)) continue
    const base = ctx.catalog.recipesById.get(e.recipeId)
    if (!base) {
      missingRecipes.push(e.recipeId)
      continue
    }
    meals.push({ entryId: e.id, date: e.date, recipe: resolveRecipe(base, e.variant, ctx), servings: e.servings })
  }
  return { meals, missingRecipes }
}

type Acc = {
  ing: Ingredient
  needed: number
  extra: Map<Unit, number>
  toTaste: boolean
  sources: ShoppingSource[]
  firstDate?: string
}

export type BuildOptions = {
  catalog: Catalog
  pantry?: PantryItem[]
  manual?: ManualShoppingItem[]
  overrides?: ShoppingOverride[]
  /** AAAA-MM-JJ : le stock perime avant cette date est ignore. */
  today?: string
  usePackages?: boolean
}

export function aggregateNeeds(meals: MealNeed[], catalog: Catalog): Map<string, Acc> {
  const acc = new Map<string, Acc>()
  for (const meal of meals) {
    const factor = meal.servings / meal.recipe.servings
    for (const line of meal.recipe.ingredients) {
      if (line.optional) continue
      const ing = ingredientOf(catalog, line.ingredientId)
      let a = acc.get(ing.id)
      if (!a) acc.set(ing.id, (a = { ing, needed: 0, extra: new Map(), toTaste: false, sources: [] }))
      if (meal.date && (!a.firstDate || meal.date < a.firstDate)) a.firstDate = meal.date
      if (line.quantity == null) {
        a.toTaste = true
        a.sources.push({ entryId: meal.entryId, recipeId: meal.recipe.id, recipeName: meal.recipe.name, date: meal.date, amount: 0 })
        continue
      }
      // Pas d'arrondi ici : on additionne les quantites exactes et on n'arrondit qu'a l'achat.
      const scaled = line.quantity * factor
      const base = toBase(scaled, line.unit, ing)
      if (base == null) a.extra.set(line.unit, (a.extra.get(line.unit) ?? 0) + scaled)
      else a.needed += base
      a.sources.push({ entryId: meal.entryId, recipeId: meal.recipe.id, recipeName: meal.recipe.name, date: meal.date, amount: base ?? 0 })
    }
  }
  return acc
}

/**
 * Part des besoins couverte par le stock, repas par repas : un produit ne couvre que les repas
 * prevus AVANT sa date de peremption (une courgette qui perime lundi ne sert pas au repas de samedi).
 * Les produits qui periment le plus tot sont affectes en premier aux repas les plus proches.
 */
function pantryFor(ing: Ingredient, pantry: PantryItem[], today: string | undefined, sources: ShoppingSource[], warnings: string[]) {
  let unknown = false
  const needs = sources
    .filter((s) => s.amount > 0)
    .map((s) => ({ date: s.date ?? today ?? '', left: s.amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const items = pantry
    .filter((p) => p.ingredientId === ing.id)
    .sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'))

  let covered = 0
  let expiredUnused = false
  for (const p of items) {
    if (p.expiresOn && today && p.expiresOn < today) {
      warnings.push(`${ing.name} de ton stock est périmé (${p.expiresOn}) : non déduit de la liste.`)
      continue
    }
    if (p.quantity == null) {
      // Quantite inconnue : on suppose qu'elle couvre les repas d'avant la peremption.
      if (!p.expiresOn || needs.some((n) => n.left > EPS && n.date <= p.expiresOn!)) unknown = true
      continue
    }
    let have = toBase(p.quantity, p.unit, ing)
    if (have == null) {
      unknown = true
      continue
    }
    for (const n of needs) {
      if (have <= EPS) break
      if (n.left <= EPS || (p.expiresOn && n.date > p.expiresOn)) continue
      const used = Math.min(have, n.left)
      n.left -= used
      have -= used
      covered += used
    }
    if (have > EPS && p.expiresOn && needs.some((n) => n.left > EPS && n.date > p.expiresOn!)) expiredUnused = true
  }
  if (expiredUnused) warnings.push(`${ing.name} de ton stock sera périmé avant certains repas : seule une partie est déduite.`)
  return { covered, unknown }
}

function costOf(ing: Ingredient, amount: number): number | null {
  if (ing.pricePerKgOrUnit == null) return null
  const c = ing.baseUnit === 'piece' ? amount * ing.pricePerKgOrUnit : (amount / 1000) * ing.pricePerKgOrUnit
  return Math.round(c * 100) / 100
}

export function buildShoppingList(meals: MealNeed[], opts: BuildOptions): ShoppingList {
  const { catalog, pantry = [], manual = [], overrides = [], today, usePackages = true } = opts
  const warnings: string[] = []
  const acc = aggregateNeeds(meals, catalog)
  const overrideOf = new Map(overrides.map((o) => [o.key, o]))
  const lines: ShoppingLine[] = []

  // Ajouts manuels rattaches au referentiel : additionnes a la ligne calculee correspondante.
  const manualByIng = new Map<string, ManualShoppingItem[]>()
  const freeManual: ManualShoppingItem[] = []
  for (const m of manual) {
    if (m.ingredientId && catalog.ingredients.has(m.ingredientId)) {
      const list = manualByIng.get(m.ingredientId) ?? []
      list.push(m)
      manualByIng.set(m.ingredientId, list)
      if (!acc.has(m.ingredientId)) {
        acc.set(m.ingredientId, { ing: ingredientOf(catalog, m.ingredientId), needed: 0, extra: new Map(), toTaste: false, sources: [] })
      }
    } else freeManual.push(m)
  }

  for (const a of acc.values()) {
    const { ing } = a
    const manualItems = manualByIng.get(ing.id) ?? []
    let manualAmount = 0
    for (const m of manualItems) {
      if (m.quantity == null) continue
      const base = toBase(m.quantity, m.unit, ing)
      if (base == null) a.extra.set(m.unit, (a.extra.get(m.unit) ?? 0) + m.quantity)
      else manualAmount += base
    }

    const stock = pantryFor(ing, pantry, today, a.sources, warnings)
    // Le stock couvre les besoins des recettes ; un ajout manuel est une demande explicite d'achat.
    const fromPantry = Math.min(a.needed, stock.covered)
    const remainingRecipe = Math.max(0, a.needed - fromPantry)
    const stockCoversUnknown = stock.unknown && remainingRecipe > EPS
    let toBuy = (stockCoversUnknown || ing.staple ? 0 : remainingRecipe) + manualAmount

    const o = overrideOf.get(ing.id)
    let overridden = false
    if (o?.quantityOverride != null) {
      toBuy = Math.max(0, o.quantityOverride)
      overridden = true
    }

    let purchase: Purchase | undefined
    if (toBuy > EPS) {
      if (usePackages && !overridden && ing.packages && ing.packages.length > 0) purchase = choosePackages(toBuy, ing.packages) ?? undefined
      else if (ing.baseUnit === 'piece') {
        const total = Math.ceil(toBuy - EPS)
        purchase = { packs: [{ size: 1, count: total }], total, leftover: total - toBuy }
      }
    }
    const buyAmount = purchase?.total ?? toBuy
    const extraList = [...a.extra.entries()].map(([unit, quantity]) => ({ unit, quantity: Math.round(quantity * 100) / 100 }))

    lines.push({
      key: ing.id,
      ingredientId: ing.id,
      label: ing.name,
      aisle: ing.aisle,
      baseUnit: ing.baseUnit,
      needed: a.needed + manualAmount,
      fromPantry,
      toBuy,
      purchase,
      extra: extraList,
      toTaste: a.toTaste,
      stockUnknown: stockCoversUnknown,
      staple: !!ing.staple,
      estimatedCost: buyAmount > EPS ? costOf(ing, buyAmount) : 0,
      sources: a.sources,
      manualIds: manualItems.map((m) => m.id),
      recurring: manualItems.some((m) => m.recurring),
      checked: o?.checked ?? (manualItems.length > 0 && manualItems.every((m) => m.checked)),
      store: o?.store ?? manualItems.find((m) => m.store)?.store,
      overridden,
    })
  }

  for (const m of freeManual) {
    const o = overrideOf.get(`manuel:${m.id}`)
    lines.push({
      key: `manuel:${m.id}`,
      label: m.label,
      aisle: m.aisle,
      needed: m.quantity ?? 0,
      fromPantry: 0,
      toBuy: m.quantity ?? 1,
      extra: m.quantity != null && m.unit !== 'piece' ? [{ quantity: m.quantity, unit: m.unit }] : [],
      toTaste: false,
      stockUnknown: false,
      staple: false,
      estimatedCost: null,
      sources: [],
      manualIds: [m.id],
      recurring: m.recurring,
      checked: o?.checked ?? m.checked,
      store: o?.store ?? m.store,
      overridden: false,
    })
  }

  const removedKeys = new Set(overrides.filter((o) => o.removed).map((o) => o.key))
  const removed = lines.filter((l) => removedKeys.has(l.key))
  const active = lines.filter((l) => !removedKeys.has(l.key))
  const isToBuy = (l: ShoppingLine) => l.toBuy > EPS || (l.extra.length > 0 && !l.staple && !l.stockUnknown) || (!l.ingredientId)
  const toBuyLines = active.filter(isToBuy)
  const covered = active.filter((l) => !isToBuy(l))

  const sortLines = (a: ShoppingLine, b: ShoppingLine) => Number(a.checked) - Number(b.checked) || a.label.localeCompare(b.label, 'fr')
  const byAisle = AISLE_ORDER.map((aisle) => ({ aisle, lines: toBuyLines.filter((l) => l.aisle === aisle).sort(sortLines) })).filter((g) => g.lines.length > 0)

  const priced = toBuyLines.filter((l) => l.estimatedCost != null)
  const cost = {
    value: Math.round(priced.reduce((s, l) => s + (l.estimatedCost ?? 0), 0) * 100) / 100,
    pricedLines: priced.length,
    totalLines: toBuyLines.length,
  }

  return { lines: active, byAisle, covered: covered.sort(sortLines), removed, cost, warnings: [...new Set(warnings)] }
}

/** Ingredients manquants pour cuisiner une recette maintenant, compte tenu du stock. */
export function missingIngredients(recipe: Recipe, servings: number, pantry: PantryItem[], catalog: Catalog, today?: string): ShoppingLine[] {
  const list = buildShoppingList([{ recipe, servings }], { catalog, pantry, today, usePackages: false })
  return list.byAisle.flatMap((g) => g.lines).filter((l) => !l.staple)
}

/**
 * Part des ingredients (hors placard et "selon le gout") deja disponibles, ponderee par la quantite
 * couverte -- sert au classement "cuisiner avec ce que j'ai".
 */
export function pantryCoverage(recipe: Recipe, pantry: PantryItem[], catalog: Catalog, today?: string): { ratio: number; usesExpiring: string[] } {
  if (pantry.length === 0) return { ratio: 0, usesExpiring: [] }
  const acc = aggregateNeeds([{ recipe, servings: recipe.servings }], catalog)
  let total = 0
  let covered = 0
  const usesExpiring: string[] = []
  const soon = today ? addDays(today, 3) : undefined
  for (const a of acc.values()) {
    if (a.ing.staple || (a.needed <= EPS && a.toTaste)) continue
    total++
    const items = pantry.filter((p) => p.ingredientId === a.ing.id && !(p.expiresOn && today && p.expiresOn < today))
    if (items.length === 0) continue
    if (soon && items.some((p) => p.expiresOn && p.expiresOn <= soon)) usesExpiring.push(a.ing.id)
    if (items.some((p) => p.quantity == null)) {
      covered += 1
      continue
    }
    const have = items.reduce((s, p) => s + (toBase(p.quantity!, p.unit, a.ing) ?? 0), 0)
    covered += a.needed <= EPS ? 1 : Math.min(1, have / a.needed)
  }
  return { ratio: total === 0 ? 0 : covered / total, usesExpiring }
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}
