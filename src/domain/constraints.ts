import type { Allergen, Diet, Equipment, IngredientTag, Profile, Recipe } from './types'
import { type Catalog, ingredientOf } from './catalog'

// Contraintes STRICTES : allergies, ingredients exclus, regime (vegetarien/vegetalien/pescetarien)
// et equipement. Une recette qui les viole n'apparait jamais dans une suggestion ou un planning
// automatique -- seule une VARIANTE qui les leve (variants.ts) peut etre proposee, et elle est alors
// re-verifiee ici. Les gouts (aime / n'aime pas) ne sont jamais des contraintes : cf. scoring.ts.

export type Violation = {
  kind: 'allergene' | 'exclu' | 'regime' | 'equipement'
  ingredientId?: string
  allergen?: Allergen
  equipment?: Equipment
  /** Porte uniquement par un ingredient optionnel : la recette reste possible en l'omettant. */
  optional: boolean
  message: string
}

export type ConstraintCheck = {
  allowed: boolean
  violations: Violation[]
  /** Ingredients optionnels a retirer pour respecter le profil. */
  omit: string[]
}

const DIET_FORBIDDEN: Record<Diet, IngredientTag[]> = {
  omnivore: [],
  flexitarien: [],
  pescetarien: ['viande_rouge', 'volaille', 'porc', 'charcuterie', 'origine_animale'],
  vegetarien: ['viande_rouge', 'volaille', 'porc', 'charcuterie', 'origine_animale', 'poisson', 'fruits_de_mer'],
  vegetalien: ['viande_rouge', 'volaille', 'porc', 'charcuterie', 'origine_animale', 'poisson', 'fruits_de_mer', 'produit_laitier', 'fromage', 'creme', 'oeuf', 'miel'],
}

const DIET_LABEL: Record<Diet, string> = {
  omnivore: 'omnivore', flexitarien: 'flexitarien', pescetarien: 'pescétarien', vegetarien: 'végétarien', vegetalien: 'végétalien',
}

export const DEFAULT_EQUIPMENT: Equipment[] = ['plaque', 'four']

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  gluten: 'Gluten', crustaces: 'Crustacés', oeufs: 'Œufs', poisson: 'Poisson', arachides: 'Arachides', soja: 'Soja',
  lait: 'Lait', fruits_a_coque: 'Fruits à coque', celeri: 'Céleri', moutarde: 'Moutarde', sesame: 'Sésame',
  sulfites: 'Sulfites', lupin: 'Lupin', mollusques: 'Mollusques',
}

type ConstraintProfile = Pick<Profile, 'allergens' | 'excludedIngredients' | 'diet' | 'equipment'>

export function checkRecipe(recipe: Recipe, profile: ConstraintProfile, catalog: Catalog): ConstraintCheck {
  const violations: Violation[] = []
  const forbiddenTags = DIET_FORBIDDEN[profile.diet]
  const allergens = new Set(profile.allergens)
  const excluded = new Set(profile.excludedIngredients)

  for (const line of recipe.ingredients) {
    const ing = ingredientOf(catalog, line.ingredientId)
    const optional = !!line.optional
    for (const a of ing.allergens) {
      if (allergens.has(a)) {
        violations.push({ kind: 'allergene', ingredientId: ing.id, allergen: a, optional, message: `${ing.name} contient : ${ALLERGEN_LABEL[a].toLowerCase()}` })
      }
    }
    if (excluded.has(ing.id)) {
      violations.push({ kind: 'exclu', ingredientId: ing.id, optional, message: `${ing.name} fait partie de tes exclusions` })
    }
    const tag = ing.tags.find((t) => forbiddenTags.includes(t))
    if (tag) {
      violations.push({ kind: 'regime', ingredientId: ing.id, optional, message: `${ing.name} n'est pas compatible avec un régime ${DIET_LABEL[profile.diet]}` })
    }
  }

  const equipment = new Set(profile.equipment.length > 0 ? profile.equipment : DEFAULT_EQUIPMENT)
  for (const e of recipe.equipment) {
    if (!equipment.has(e)) violations.push({ kind: 'equipement', equipment: e, optional: false, message: `Nécessite : ${EQUIPMENT_LABEL[e].toLowerCase()}` })
  }

  const blocking = violations.filter((v) => !v.optional)
  const omit = [...new Set(violations.filter((v) => v.optional && v.ingredientId).map((v) => v.ingredientId!))]
  return { allowed: blocking.length === 0, violations, omit }
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  four: 'Four', plaque: 'Plaques de cuisson', micro_ondes: 'Micro-ondes', air_fryer: 'Air fryer', mixeur: 'Mixeur',
  robot: 'Robot cuiseur', cuiseur_riz: 'Cuiseur à riz', autocuiseur: 'Autocuiseur',
}

/** Recette prete a servir pour ce profil : les ingredients optionnels incompatibles sont retires. */
export function applyOmissions(recipe: Recipe, omit: string[]): Recipe {
  if (omit.length === 0) return recipe
  return { ...recipe, ingredients: recipe.ingredients.filter((l) => !omit.includes(l.ingredientId)) }
}
