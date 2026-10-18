// Modele de donnees du moteur Mijote. Aucune dependance a React ni a Supabase : tout ce qui est
// ici peut etre teste en isolation (cf. src/domain/__tests__) et reutilise cote serveur (assistant)
// comme cote client (ecrans).
//
// Principe directeur : les informations DERIVEES d'une recette (allergenes, regimes compatibles,
// cout, nutrition, saison) ne sont jamais saisies a la main sur la recette -- elles sont calculees a
// partir du referentiel d'ingredients, avec un taux de couverture. Une substitution ou un changement
// de portions les recalcule donc toujours de facon coherente, et une donnee manquante reste visible
// comme manquante au lieu d'etre inventee.

// --- Unites ----------------------------------------------------------------------------------------

/** Unite de reference d'un ingredient : toutes les quantites sont ramenees a l'une d'elles. */
export type BaseUnit = 'g' | 'ml' | 'piece'

/** Unites acceptees dans une recette ou une saisie manuelle. */
export type Unit =
  | 'g' | 'kg'
  | 'ml' | 'cl' | 'l'
  | 'cas' // cuillere a soupe (15 ml)
  | 'cac' // cuillere a cafe (5 ml)
  | 'pincee'
  | 'piece'
  | 'gousse' | 'tranche' | 'botte' | 'boite' | 'sachet' // conditionnements "naturels", convertis via l'ingredient

// --- Referentiel ingredients -----------------------------------------------------------------------

export type Aisle =
  | 'fruits_legumes'
  | 'boucherie_poisson'
  | 'cremerie' // produits laitiers, oeufs
  | 'epicerie_salee'
  | 'epicerie_sucree'
  | 'boulangerie'
  | 'surgeles'
  | 'boissons'
  | 'condiments' // epices, sauces, huiles
  | 'autre'

/** Les 14 allergenes a declaration obligatoire (reglement UE 1169/2011). */
export type Allergen =
  | 'gluten' | 'crustaces' | 'oeufs' | 'poisson' | 'arachides' | 'soja' | 'lait'
  | 'fruits_a_coque' | 'celeri' | 'moutarde' | 'sesame' | 'sulfites' | 'lupin' | 'mollusques'

/** Caracteristiques utilisees par les regimes, les objectifs et les substitutions. */
export type IngredientTag =
  | 'viande_rouge' | 'volaille' | 'porc' | 'charcuterie' | 'poisson' | 'fruits_de_mer'
  | 'produit_laitier' | 'oeuf' | 'miel' | 'origine_animale' // origine_animale : gelatine, bouillon de boeuf...
  | 'legume' | 'fruit' | 'legumineuse' | 'feculent' | 'cereale_complete'
  | 'proteine_vegetale' | 'fromage' | 'creme' | 'sucre_ajoute' | 'ultra_transforme' | 'alcool'
  | 'herbe_epice' | 'matiere_grasse'

export type DataSource = 'ciqual_approx' | 'off' | 'estimation' | 'user'

/** Valeurs pour 100 g (ou 100 ml pour un liquide). */
export type Nutrition = {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar?: number
  salt?: number
}

export type Ingredient = {
  id: string
  name: string
  /** Pluriel affiche quand la quantite est en pieces (> 1). */
  plural?: string
  /** Autres facons de le nommer, pour la recherche ("poulet" -> blanc de poulet). */
  aliases?: string[]
  aisle: Aisle
  baseUnit: BaseUnit
  /** g par ml -- permet de passer d'une cuillere a un poids. */
  density?: number
  /** Poids moyen d'une piece (oeuf, oignon, gousse...), en g. */
  pieceGrams?: number
  /** Taille de conditionnement "naturel" (botte, boite, sachet...) exprimee dans baseUnit. */
  unitSizes?: Partial<Record<Unit, number>>
  allergens: Allergen[]
  tags: IngredientTag[]
  /** Mois de pleine saison (1-12). Absent = disponible toute l'annee / non pertinent. */
  seasonMonths?: number[]
  nutrition?: Nutrition
  nutritionSource?: DataSource
  /** Prix estime en euros par kg (baseUnit g), par litre (ml) ou par piece. */
  pricePerKgOrUnit?: number
  priceSource?: DataSource
  /** Conditionnements vendus en magasin, exprimes dans baseUnit (ex. riz : [500, 1000]). */
  packages?: number[]
  /** Duree de conservation indicative une fois achete, en jours. */
  shelfLifeDays?: number
  /** Ingredient de placard qu'on a "toujours" (sel, poivre, huile) : jamais additionne en quantite. */
  staple?: boolean
}

// --- Recettes ------------------------------------------------------------------------------------

export type MealSlot = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation'
export type CourseType = 'plat' | 'entree' | 'dessert' | 'accompagnement' | 'petit_dejeuner' | 'collation' | 'soupe' | 'salade'
export type Equipment = 'four' | 'plaque' | 'micro_ondes' | 'air_fryer' | 'mixeur' | 'robot' | 'cuiseur_riz' | 'autocuiseur'
export type Difficulty = 1 | 2 | 3

export type RecipeTag = 'rapide' | 'reconfortant' | 'batch' | 'economique' | 'leger' | 'gourmand' | 'enfants' | 'sans_cuisson' | 'anti_gaspi' | 'convivial'

export type RecipeIngredient = {
  ingredientId: string
  /** null = "selon le gout" (sel, poivre...) : jamais additionne, jamais mis a l'echelle. */
  quantity: number | null
  unit: Unit
  note?: string
  optional?: boolean
}

export type RecipeSource = {
  kind: 'mijote' | 'import_url' | 'utilisateur' | 'themealdb'
  url?: string
  label?: string
}

export type Recipe = {
  id: string
  name: string
  description: string
  /** Emoji de repli tant qu'aucune photo n'est disponible. */
  emoji: string
  image?: string
  servings: number
  prepMinutes: number
  cookMinutes: number
  difficulty: Difficulty
  slots: MealSlot[]
  course: CourseType
  cuisine?: string
  equipment: Equipment[]
  ingredients: RecipeIngredient[]
  steps: string[]
  tags: RecipeTag[]
  storage: { fridgeDays: number; freezable: boolean }
  pairings?: string[]
  source: RecipeSource
  /** Renseigne sur une version adaptee : id de la recette d'origine. */
  baseRecipeId?: string
  variant?: VariantInfo
}

// --- Profil -------------------------------------------------------------------------------------

export type Diet = 'omnivore' | 'flexitarien' | 'pescetarien' | 'vegetarien' | 'vegetalien'

export type Goal =
  | 'manger_sainement' | 'equilibre' | 'perte_poids' | 'prise_masse' | 'proteines'
  | 'moins_viande' | 'plus_legumes' | 'moins_transforme' | 'moins_sucre' | 'moins_sel'
  | 'plaisir' | 'apprendre' | 'organisation' | 'anti_gaspi' | 'petit_budget'

/** Le meme objectif n'a pas le meme poids selon l'approche choisie -- jamais impose. */
export type GoalIntensity = 'souple' | 'modere' | 'strict'

export type Profile = {
  displayName?: string
  diet: Diet
  /** Contraintes STRICTES : une recette qui les contient n'est jamais proposee telle quelle. */
  allergens: Allergen[]
  excludedIngredients: string[]
  /** Preferences : influencent le classement, jamais un filtre. */
  dislikedIngredients: string[]
  likedIngredients: string[]
  goals: { goal: Goal; intensity: GoalIntensity }[]
  householdSize: number
  budget?: { amount: number; period: 'semaine' | 'mois' }
  /** Temps max (preparation + cuisson active) un jour de semaine / le week-end, en minutes. */
  maxMinutesWeekday: number
  maxMinutesWeekend: number
  skill: Difficulty
  /** Equipements disponibles. La plaque est supposee presente si la liste est vide. */
  equipment: Equipment[]
  /** 0 = toujours les memes valeurs sures, 1 = surprends-moi. */
  discovery: number
  preferSeasonal: boolean
  cookingStyle: 'chaque_jour' | 'batch' | 'mixte'
  leftoversOk: boolean
  slots: MealSlot[]
  onboardingDone: boolean
}

// --- Variantes ----------------------------------------------------------------------------------

export type VariantKind =
  | 'vegetarienne' | 'vegetalienne' | 'proteinee' | 'economique' | 'rapide'
  | 'equilibree' | 'gourmande' | 'sans_allergenes' | 'avec_mon_stock'

export type Confidence = 'haute' | 'moyenne' | 'faible'

export type VariantChange =
  | { type: 'substitution'; from: string; to: string; ratio: number; confidence: Confidence; note: string }
  | { type: 'ajout'; ingredientId: string; quantity: number; unit: Unit; note: string }
  | { type: 'retrait'; ingredientId: string; note: string }
  | { type: 'quantite'; ingredientId: string; factor: number; note: string }
  | { type: 'temps'; deltaMinutes: number; note: string }

export type VariantInfo = {
  kind: VariantKind
  changes: VariantChange[]
  confidence: Confidence
  warnings: string[]
}

// --- Planning, stock, courses -------------------------------------------------------------------

export type PlanEntry = {
  id: string
  /** Date locale AAAA-MM-JJ. */
  date: string
  slot: MealSlot
  /** 'recette' : on cuisine ; 'reste' : on mange un reste (aucune course) ; 'exterieur' : repas hors maison. */
  kind: 'recette' | 'reste' | 'exterieur'
  recipeId?: string
  /** Variante appliquee a la recette, recalculee a la volee. */
  variant?: VariantKind
  servings: number
  /** Pour un repas cuisine en double : nombre de portions destinees a un reste ulterieur (incluses dans servings). */
  leftoverServings?: number
  /** Pour une entree 'reste' : l'entree cuisinee d'origine. */
  leftoverOf?: string
  locked?: boolean
  /** Renseigne quand l'utilisateur indique avoir cuisine ce repas (le stock a ete deduit). */
  cookedAt?: string
  note?: string
}

export type PantryItem = {
  id: string
  ingredientId: string
  /** null = "j'en ai, quantite inconnue". */
  quantity: number | null
  unit: Unit
  /** AAAA-MM-JJ */
  expiresOn?: string
  /** Date calculee a partir de la duree de conservation type (ajout depuis la liste de courses). */
  expiryEstimated?: boolean
  addedOn: string
  /** Prevu pour le scan code-barres / photo, sans rien changer au reste. */
  source: 'manuel' | 'code_barres' | 'photo' | 'courses'
  barcode?: string
}

export type ManualShoppingItem = {
  id: string
  /** Liste de rattachement ; null pour un article recurrent (present dans toutes les listes). */
  listId?: string | null
  /** Rattache au referentiel si possible (permet l'agregation), sinon libelle libre. */
  ingredientId?: string
  label: string
  quantity: number | null
  unit: Unit
  aisle: Aisle
  recurring: boolean
  checked: boolean
  store?: string
}

/** Ce que l'utilisateur a modifie sur une ligne CALCULEE : conserve d'un recalcul a l'autre. */
export type ShoppingOverride = {
  /** Cle de la ligne : ingredientId d'une ligne calculee, ou "manuel:<id>" pour un ajout libre. */
  key: string
  checked?: boolean
  removed?: boolean
  /** Quantite a acheter imposee (dans baseUnit). */
  quantityOverride?: number
  store?: string
}

export type ShoppingListMeta = {
  id: string
  name: string
  /** semaine : planning de la semaine ; periode : dates libres ; recette : une seule recette ; libre : ajouts manuels seulement. */
  mode: 'semaine' | 'periode' | 'recette' | 'libre'
  from?: string
  to?: string
  recipeId?: string
  servings?: number
  createdAt: string
}
