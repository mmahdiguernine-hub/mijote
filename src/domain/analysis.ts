import type { Allergen, Confidence, Diet, IngredientTag, Nutrition, Recipe } from './types'
import { type Catalog, ingredientOf } from './catalog'
import { baseToGrams, toBase } from './units'

// Informations derivees d'une recette, toujours recalculees depuis le referentiel. Chaque estimation
// porte son taux de couverture : "3,20 € (estimé, 80 % des ingrédients chiffrés)" plutot qu'un
// chiffre presente comme exact.

export type Estimate<T> = { value: T; coverage: number; confidence: Confidence }

export type RecipeAnalysis = {
  allergens: Allergen[]
  /** Allergenes portes uniquement par des ingredients optionnels (a omettre). */
  optionalAllergens: Allergen[]
  diets: Diet[]
  /** Cout de la recette entiere / par portion, en euros. */
  cost: Estimate<number>
  costPerServing: Estimate<number>
  /** Par portion. */
  nutrition: Estimate<Nutrition>
  totalMinutes: number
  /** Part des ingredients de saison (fruits/legumes concernes) pour le mois donne, 1 si non concerne. */
  seasonality: number
  /** Nombre de fruits/legumes a saisonnalite connue dans la recette. */
  seasonalItems: number
  vegetableGrams: number
  tags: Set<IngredientTag>
}

const MEAT: IngredientTag[] = ['viande_rouge', 'volaille', 'porc', 'charcuterie', 'origine_animale']
const SEAFOOD: IngredientTag[] = ['poisson', 'fruits_de_mer']
const ANIMAL: IngredientTag[] = [...MEAT, ...SEAFOOD, 'produit_laitier', 'oeuf', 'miel', 'fromage', 'creme']

/** Regimes compatibles a partir des tags des ingredients (non optionnels). */
export function dietsFromTags(tags: Set<IngredientTag>): Diet[] {
  const has = (list: IngredientTag[]) => list.some((t) => tags.has(t))
  const diets: Diet[] = ['omnivore', 'flexitarien']
  if (!has(MEAT)) diets.push('pescetarien')
  if (!has(MEAT) && !has(SEAFOOD)) diets.push('vegetarien')
  if (!has(ANIMAL)) diets.push('vegetalien')
  return diets
}

export function confidenceOf(coverage: number): Confidence {
  return coverage >= 0.9 ? 'haute' : coverage >= 0.7 ? 'moyenne' : 'faible'
}

const EMPTY_NUTRITION: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 }

export function analyzeRecipe(recipe: Recipe, catalog: Catalog, month = new Date().getMonth() + 1): RecipeAnalysis {
  const allergens = new Set<Allergen>()
  const optionalAllergens = new Set<Allergen>()
  const tags = new Set<IngredientTag>()
  let cost = 0
  let priced = 0
  let priceable = 0
  const nut: Nutrition = { ...EMPTY_NUTRITION }
  let nutKnown = 0
  let nutCountable = 0
  let seasonalTotal = 0
  let seasonalOk = 0
  let vegetableGrams = 0

  for (const line of recipe.ingredients) {
    const ing = ingredientOf(catalog, line.ingredientId)
    if (line.optional) {
      ing.allergens.forEach((a) => optionalAllergens.add(a))
    } else {
      ing.allergens.forEach((a) => allergens.add(a))
      ing.tags.forEach((t) => tags.add(t))
    }
    if (line.quantity == null || line.optional) continue

    const base = toBase(line.quantity, line.unit, ing)
    priceable++
    nutCountable++
    if (base == null) continue

    if (ing.pricePerKgOrUnit != null) {
      cost += ing.baseUnit === 'piece' ? base * ing.pricePerKgOrUnit : (base / 1000) * ing.pricePerKgOrUnit
      priced++
    }
    const grams = baseToGrams(base, ing)
    if (grams != null && ing.nutrition) {
      const f = grams / 100
      nut.kcal += ing.nutrition.kcal * f
      nut.protein += ing.nutrition.protein * f
      nut.carbs += ing.nutrition.carbs * f
      nut.fat += ing.nutrition.fat * f
      nut.fiber += ing.nutrition.fiber * f
      nut.sugar! += (ing.nutrition.sugar ?? 0) * f
      nut.salt! += (ing.nutrition.salt ?? 0) * f
      nutKnown++
    }
    if (grams != null && (ing.tags.includes('legume') || ing.tags.includes('legumineuse'))) vegetableGrams += grams
    if (ing.seasonMonths && (ing.tags.includes('legume') || ing.tags.includes('fruit'))) {
      seasonalTotal++
      if (ing.seasonMonths.includes(month)) seasonalOk++
    }
  }

  // Un allergene deja present dans un ingredient obligatoire n'est pas "optionnel".
  allergens.forEach((a) => optionalAllergens.delete(a))
  const s = Math.max(1, recipe.servings)
  const costCoverage = priceable === 0 ? 1 : priced / priceable
  const nutCoverage = nutCountable === 0 ? 1 : nutKnown / nutCountable
  const perServing = Object.fromEntries(Object.entries(nut).map(([k, v]) => [k, Math.round((v / s) * 10) / 10])) as Nutrition
  perServing.kcal = Math.round(nut.kcal / s)

  return {
    allergens: [...allergens],
    optionalAllergens: [...optionalAllergens],
    diets: dietsFromTags(tags),
    cost: { value: round2(cost), coverage: costCoverage, confidence: confidenceOf(costCoverage) },
    costPerServing: { value: round2(cost / s), coverage: costCoverage, confidence: confidenceOf(costCoverage) },
    nutrition: { value: perServing, coverage: nutCoverage, confidence: confidenceOf(nutCoverage) },
    totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
    seasonality: seasonalTotal === 0 ? 1 : seasonalOk / seasonalTotal,
    seasonalItems: seasonalTotal,
    vegetableGrams: vegetableGrams / s,
    tags,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Analyse memoisee par objet recette (les recettes du catalogue sont immuables). */
const cache = new WeakMap<Recipe, Map<number, RecipeAnalysis>>()
export function analyzeCached(recipe: Recipe, catalog: Catalog, month = new Date().getMonth() + 1): RecipeAnalysis {
  let byMonth = cache.get(recipe)
  if (!byMonth) cache.set(recipe, (byMonth = new Map()))
  let a = byMonth.get(month)
  if (!a) byMonth.set(month, (a = analyzeRecipe(recipe, catalog, month)))
  return a
}
