import type { Recipe, RecipeIngredient, Unit } from './types'

// Adaptation d'une recette a un nombre de portions. Proportionnel pour les ingredients mesures,
// avec deux exceptions volontaires :
// - "selon le gout" (quantite null) : jamais mis a l'echelle ;
// - unites "entieres" (pieces, gousses, boites...) : arrondies au demi (oeufs : a l'unite superieure),
//   car on n'achete pas 0,37 oeuf -- l'arrondi est signale dans la note de la ligne.
// Les temps de cuisson ne changent pas lineairement : on garde ceux de la recette et on le signale
// au-dela d'un facteur 2.

const WHOLE_UNITS: Unit[] = ['piece', 'gousse', 'boite', 'sachet', 'botte', 'tranche']
const ROUND_UP_IDS = new Set(['oeuf'])

export function scaleQuantity(q: number, factor: number, unit: Unit, ingredientId: string): { value: number; rounded: boolean } {
  const raw = q * factor
  if (!WHOLE_UNITS.includes(unit)) return { value: Math.round(raw * 100) / 100, rounded: false }
  const value = ROUND_UP_IDS.has(ingredientId) ? Math.max(1, Math.ceil(raw - 0.15)) : Math.max(0.5, Math.round(raw * 2) / 2)
  return { value, rounded: Math.abs(value - raw) > 0.01 }
}

export function scaleIngredients(lines: RecipeIngredient[], factor: number): RecipeIngredient[] {
  if (factor === 1) return lines
  return lines.map((l) => {
    if (l.quantity == null) return l
    const { value, rounded } = scaleQuantity(l.quantity, factor, l.unit, l.ingredientId)
    return rounded ? { ...l, quantity: value, note: [l.note, 'quantité arrondie'].filter(Boolean).join(' · ') } : { ...l, quantity: value }
  })
}

export type ScaledRecipe = Recipe & { scaledFrom: number; scaleWarnings: string[] }

export function scaleRecipe(recipe: Recipe, servings: number): ScaledRecipe {
  if (!Number.isFinite(servings) || servings <= 0) throw new Error('Nombre de portions invalide')
  const factor = servings / recipe.servings
  const warnings: string[] = []
  if (factor >= 2 || factor <= 0.5) {
    warnings.push('Temps de cuisson et taille du plat à ajuster : ils ne varient pas proportionnellement aux quantités.')
  }
  if (factor !== 1 && recipe.ingredients.some((l) => l.quantity == null)) {
    warnings.push('Assaisonnement à ajuster au goût.')
  }
  return { ...recipe, servings, ingredients: scaleIngredients(recipe.ingredients, factor), scaledFrom: recipe.servings, scaleWarnings: warnings }
}
