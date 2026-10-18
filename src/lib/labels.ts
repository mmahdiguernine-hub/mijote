import type { Allergen, Diet, Goal, GoalIntensity, MealSlot } from '@/domain/types'

export const DIET_OPTIONS: { value: Diet; label: string; hint: string }[] = [
  { value: 'omnivore', label: 'Je mange de tout', hint: 'Viande, poisson, végétal' },
  { value: 'flexitarien', label: 'Flexitarien', hint: 'Surtout végétal, un peu de viande' },
  { value: 'pescetarien', label: 'Pescétarien', hint: 'Poisson, pas de viande' },
  { value: 'vegetarien', label: 'Végétarien', hint: 'Ni viande ni poisson' },
  { value: 'vegetalien', label: 'Végétalien', hint: 'Aucun produit animal' },
]

export const ALLERGEN_OPTIONS: Allergen[] = ['gluten', 'lait', 'oeufs', 'arachides', 'fruits_a_coque', 'soja', 'poisson', 'crustaces', 'mollusques', 'sesame', 'moutarde', 'celeri', 'sulfites', 'lupin']

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'plaisir', label: 'Me faire plaisir' },
  { value: 'manger_sainement', label: 'Manger plus sainement' },
  { value: 'equilibre', label: 'Équilibrer mes repas' },
  { value: 'plus_legumes', label: 'Plus de légumes et fibres' },
  { value: 'proteines', label: 'Plus de protéines' },
  { value: 'moins_viande', label: 'Moins de viande' },
  { value: 'petit_budget', label: 'Manger à moindre coût' },
  { value: 'anti_gaspi', label: 'Moins de gaspillage' },
  { value: 'organisation', label: 'Mieux m’organiser' },
  { value: 'apprendre', label: 'Apprendre à cuisiner' },
  { value: 'moins_transforme', label: 'Moins d’ultra-transformés' },
  { value: 'moins_sucre', label: 'Moins de sucre' },
  { value: 'moins_sel', label: 'Moins de sel' },
  { value: 'perte_poids', label: 'Perdre du poids' },
  { value: 'prise_masse', label: 'Prendre du poids / de la masse' },
]

export const INTENSITY_LABEL: Record<GoalIntensity, string> = { souple: 'Souple', modere: 'Modéré', strict: 'Strict' }

export const SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: 'petit_dejeuner', label: 'Petit-déjeuner' },
  { value: 'dejeuner', label: 'Déjeuner' },
  { value: 'diner', label: 'Dîner' },
  { value: 'collation', label: 'Goûter / dessert' },
]
