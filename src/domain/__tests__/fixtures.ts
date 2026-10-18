import type { Ingredient, Profile, Recipe } from '../types'
import { buildCatalog } from '../catalog'

// Petit referentiel maitrise pour des tests lisibles (valeurs rondes).
export const ING: Ingredient[] = [
  { id: 'riz', name: 'Riz', aisle: 'epicerie_salee', baseUnit: 'g', allergens: [], tags: ['feculent'], packages: [500, 1000], pricePerKgOrUnit: 2, nutrition: { kcal: 350, protein: 7, carbs: 78, fat: 1, fiber: 1 } },
  { id: 'oeuf', name: 'Œuf', plural: 'Œufs', aisle: 'cremerie', baseUnit: 'piece', pieceGrams: 50, packages: [6, 12], pricePerKgOrUnit: 0.3, allergens: ['oeufs'], tags: ['oeuf'], nutrition: { kcal: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 } },
  { id: 'lait', name: 'Lait', aisle: 'cremerie', baseUnit: 'ml', density: 1, packages: [1000], pricePerKgOrUnit: 1, allergens: ['lait'], tags: ['produit_laitier'], nutrition: { kcal: 50, protein: 3, carbs: 5, fat: 2, fiber: 0 } },
  { id: 'blanc_poulet', name: 'Blanc de poulet', aliases: ['poulet'], aisle: 'boucherie_poisson', baseUnit: 'g', packages: [300, 600], pricePerKgOrUnit: 14, allergens: [], tags: ['volaille'], shelfLifeDays: 3, nutrition: { kcal: 110, protein: 23, carbs: 0, fat: 2, fiber: 0 } },
  { id: 'tofu_ferme', name: 'Tofu ferme', aisle: 'cremerie', baseUnit: 'g', packages: [200], pricePerKgOrUnit: 10, allergens: ['soja'], tags: ['proteine_vegetale'], shelfLifeDays: 10, nutrition: { kcal: 140, protein: 14, carbs: 2, fat: 8, fiber: 1 } },
  { id: 'courgette', name: 'Courgette', plural: 'Courgettes', aisle: 'fruits_legumes', baseUnit: 'g', pieceGrams: 250, pricePerKgOrUnit: 3, allergens: [], tags: ['legume'], seasonMonths: [6, 7, 8, 9], shelfLifeDays: 7, nutrition: { kcal: 17, protein: 1, carbs: 2, fat: 0, fiber: 1 } },
  { id: 'creme', name: 'Crème liquide', aisle: 'cremerie', baseUnit: 'ml', density: 1, packages: [200], pricePerKgOrUnit: 5, allergens: ['lait'], tags: ['produit_laitier', 'creme'], shelfLifeDays: 7, nutrition: { kcal: 300, protein: 2, carbs: 3, fat: 30, fiber: 0 } },
  { id: 'farine', name: 'Farine', aisle: 'epicerie_salee', baseUnit: 'g', density: 0.6, allergens: ['gluten'], tags: [] },
  { id: 'sel', name: 'Sel', aisle: 'condiments', baseUnit: 'g', allergens: [], tags: [], staple: true },
  { id: 'huile', name: 'Huile', aisle: 'condiments', baseUnit: 'ml', density: 0.9, allergens: [], tags: ['matiere_grasse'], staple: true, pricePerKgOrUnit: 10, nutrition: { kcal: 900, protein: 0, carbs: 0, fat: 100, fiber: 0 } },
  { id: 'cacahuete', name: 'Cacahuètes', aisle: 'epicerie_salee', baseUnit: 'g', allergens: ['arachides'], tags: [] },
  { id: 'bouillon_volaille', name: 'Bouillon de volaille', aisle: 'epicerie_salee', baseUnit: 'piece', allergens: [], tags: ['origine_animale'], pricePerKgOrUnit: 0.2 },
  { id: 'bouillon_legumes', name: 'Bouillon de légumes', aisle: 'epicerie_salee', baseUnit: 'piece', allergens: [], tags: [], pricePerKgOrUnit: 0.2 },
]

const base = (over: Partial<Recipe> & Pick<Recipe, 'id' | 'name' | 'ingredients'>): Recipe => ({
  description: '', emoji: '🍽️', servings: 2, prepMinutes: 10, cookMinutes: 10, difficulty: 1, slots: ['dejeuner', 'diner'], course: 'plat',
  equipment: ['plaque'], steps: ['Faire cuire le poulet.'], tags: [], storage: { fridgeDays: 2, freezable: false }, source: { kind: 'mijote' },
  ...over,
})

export const RECIPES: Recipe[] = [
  base({ id: 'riz-poulet', name: 'Riz au poulet', ingredients: [{ ingredientId: 'riz', quantity: 100, unit: 'g' }, { ingredientId: 'blanc_poulet', quantity: 250, unit: 'g' }, { ingredientId: 'sel', quantity: null, unit: 'pincee' }] }),
  base({ id: 'riz-courgette', name: 'Riz aux courgettes', ingredients: [{ ingredientId: 'riz', quantity: 150, unit: 'g' }, { ingredientId: 'courgette', quantity: 2, unit: 'piece' }, { ingredientId: 'huile', quantity: 1, unit: 'cas' }] }),
  base({ id: 'riz-oeuf', name: 'Riz cantonais', servings: 4, ingredients: [{ ingredientId: 'riz', quantity: 200, unit: 'g' }, { ingredientId: 'oeuf', quantity: 3, unit: 'piece' }] }),
  base({ id: 'poulet-creme', name: 'Poulet à la crème', storage: { fridgeDays: 3, freezable: true }, ingredients: [{ ingredientId: 'blanc_poulet', quantity: 300, unit: 'g' }, { ingredientId: 'creme', quantity: 20, unit: 'cl' }, { ingredientId: 'bouillon_volaille', quantity: 1, unit: 'piece' }] }),
  base({ id: 'satay', name: 'Poulet satay', ingredients: [{ ingredientId: 'blanc_poulet', quantity: 300, unit: 'g' }, { ingredientId: 'cacahuete', quantity: 50, unit: 'g' }] }),
  base({ id: 'crepes', name: 'Crêpes', course: 'dessert', slots: ['collation'], servings: 4, ingredients: [{ ingredientId: 'farine', quantity: 250, unit: 'g' }, { ingredientId: 'oeuf', quantity: 3, unit: 'piece' }, { ingredientId: 'lait', quantity: 50, unit: 'cl' }] }),
  base({ id: 'tofu-courgette', name: 'Tofu sauté aux courgettes', ingredients: [{ ingredientId: 'tofu_ferme', quantity: 200, unit: 'g' }, { ingredientId: 'courgette', quantity: 300, unit: 'g' }, { ingredientId: 'cacahuete', quantity: 20, unit: 'g', optional: true }] }),
]

export const catalog = buildCatalog(ING, RECIPES)
export const recipe = (id: string) => catalog.recipesById.get(id)!

export const profile = (over: Partial<Profile> = {}): Profile => ({
  diet: 'omnivore', allergens: [], excludedIngredients: [], dislikedIngredients: [], likedIngredients: [], goals: [],
  householdSize: 2, maxMinutesWeekday: 45, maxMinutesWeekend: 90, skill: 2, equipment: ['plaque', 'four'], discovery: 0.3,
  preferSeasonal: false, cookingStyle: 'chaque_jour', leftoversOk: true, slots: ['dejeuner', 'diner'], onboardingDone: true,
  ...over,
})
