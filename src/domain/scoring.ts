import type { Goal, GoalIntensity, MealSlot, PantryItem, Profile, Recipe, CourseType } from './types'
import type { Catalog } from './catalog'
import { analyzeCached, type RecipeAnalysis } from './analysis'
import { checkRecipe } from './constraints'
import { adaptToProfile } from './variants'
import { pantryCoverage } from './shopping'

// Classement des recettes pour un profil. Les contraintes strictes sont appliquees AVANT (une recette
// interdite n'est jamais classee, au mieux sa variante adaptee) ; ici on ne fait que PONDERER :
// gouts, objectifs (au poids de l'approche choisie), temps, budget, saison, stock, nouveaute.
// Chaque point gagne ou perdu produit une raison lisible, pour que l'utilisateur sache toujours
// pourquoi une recette lui est proposee.

export type ScoreContext = {
  profile: Profile
  catalog: Catalog
  month?: number
  today?: string
  pantry?: PantryItem[]
  /** recipeId -> jours depuis la derniere fois (historique et planning en cours). */
  recentlyEaten?: Map<string, number>
  isWeekend?: boolean
  /** Cout cible par portion (budget restant / repas restants). */
  targetCostPerServing?: number
  /** Bruit deterministe pour la variete, fourni par l'appelant (planner, "autre suggestion"). */
  random?: () => number
}

export type Scored = {
  recipe: Recipe
  /** Recette d'origine quand `recipe` est une version adaptee au profil. */
  adaptedFrom?: Recipe
  score: number
  reasons: string[]
  cautions: string[]
  analysis: RecipeAnalysis
}

const INTENSITY: Record<GoalIntensity, number> = { souple: 0.5, modere: 1, strict: 2 }

const SLOT_COURSES: Record<MealSlot, CourseType[]> = {
  petit_dejeuner: ['petit_dejeuner'],
  dejeuner: ['plat', 'salade', 'soupe'],
  diner: ['plat', 'salade', 'soupe'],
  collation: ['collation', 'dessert'],
}

export function fitsSlot(recipe: Recipe, slot: MealSlot): boolean {
  return recipe.slots.includes(slot) && SLOT_COURSES[slot].includes(recipe.course)
}

const fmtEuro = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

function goalScore(goal: Goal, a: RecipeAnalysis, recipe: Recipe, ctx: ScoreContext, pantryInfo: { ratio: number; usesExpiring: string[] }): { s: number; reason?: string; caution?: string } {
  const n = a.nutrition.value
  const meat = ['viande_rouge', 'volaille', 'porc', 'charcuterie'].some((t) => a.tags.has(t as never))
  switch (goal) {
    case 'manger_sainement':
    case 'equilibre': {
      let s = 0
      if (a.vegetableGrams >= 150) s += 0.6
      else if (a.vegetableGrams < 50) s -= 0.4
      if (n.fiber >= 6) s += 0.3
      if (a.tags.has('ultra_transforme')) s -= 0.4
      return { s, reason: s > 0.5 ? 'Bien équilibré en légumes et fibres' : undefined }
    }
    case 'plus_legumes':
      return a.vegetableGrams >= 150
        ? { s: 0.8, reason: `${Math.round(a.vegetableGrams)} g de légumes par portion` }
        : { s: a.vegetableGrams < 50 ? -0.5 : 0 }
    case 'perte_poids':
      if (a.nutrition.confidence === 'faible') return { s: 0 }
      return n.kcal <= 550 ? { s: 0.6, reason: `Environ ${n.kcal} kcal par portion (estimé)` } : n.kcal > 800 ? { s: -0.6 } : { s: 0 }
    case 'prise_masse':
      return n.kcal >= 700 && n.protein >= 25 ? { s: 0.6, reason: 'Repas copieux et protéiné' } : { s: 0 }
    case 'proteines':
      if (a.nutrition.confidence === 'faible') return { s: 0 }
      return n.protein >= 28 ? { s: 0.8, reason: `Riche en protéines (≈ ${Math.round(n.protein)} g)` } : n.protein < 15 ? { s: -0.4 } : { s: 0.1 }
    case 'moins_viande':
      return meat ? { s: -0.5 } : { s: 0.4, reason: a.diets.includes('vegetarien') ? 'Sans viande' : undefined }
    case 'moins_transforme':
      return a.tags.has('ultra_transforme') ? { s: -0.7 } : { s: 0.1 }
    case 'moins_sucre':
      return (n.sugar ?? 0) > 20 ? { s: -0.6 } : { s: 0 }
    case 'moins_sel':
      return (n.salt ?? 0) > 2.5 ? { s: -0.6, caution: 'Plutôt salé' } : { s: 0 }
    case 'plaisir':
      return recipe.tags.includes('gourmand') || recipe.tags.includes('reconfortant') ? { s: 0.6, reason: 'Gourmand' } : { s: 0 }
    case 'apprendre':
      return recipe.difficulty === Math.min(3, ctx.profile.skill + 1) ? { s: 0.5, reason: 'Pour progresser en cuisine' } : { s: 0 }
    case 'organisation':
      return recipe.tags.includes('batch') || recipe.storage.fridgeDays >= 3 ? { s: 0.5, reason: 'Se prépare à l’avance' } : { s: 0 }
    case 'anti_gaspi':
      return pantryInfo.usesExpiring.length > 0 || recipe.tags.includes('anti_gaspi') ? { s: 0.6 } : { s: 0 }
    case 'petit_budget':
      if (a.costPerServing.confidence === 'faible') return { s: 0 }
      return a.costPerServing.value <= 2 ? { s: 0.7, reason: `Économique (≈ ${fmtEuro(a.costPerServing.value)}/pers., estimé)` } : a.costPerServing.value > 4 ? { s: -0.6 } : { s: 0 }
  }
}

export function scoreRecipe(recipe: Recipe, ctx: ScoreContext, adaptedFrom?: Recipe): Scored {
  const { profile, catalog } = ctx
  const a = analyzeCached(recipe, catalog, ctx.month)
  const reasons: { w: number; text: string }[] = []
  const cautions: string[] = []
  let score = 0
  const ids = new Set(recipe.ingredients.filter((l) => !l.optional).map((l) => l.ingredientId))

  // Gouts
  const liked = profile.likedIngredients.filter((i) => ids.has(i))
  if (liked.length > 0) {
    score += Math.min(1, 0.4 * liked.length)
    const names = liked.slice(0, 2).map((i) => catalog.ingredients.get(i)?.name.toLowerCase()).filter(Boolean)
    reasons.push({ w: 0.6, text: `Avec ${names.join(' et ')}, que tu aimes` })
  }
  const disliked = profile.dislikedIngredients.filter((i) => ids.has(i))
  if (disliked.length > 0) {
    score -= 0.8 * disliked.length
    cautions.push(`Contient ${disliked.map((i) => catalog.ingredients.get(i)?.name.toLowerCase()).join(', ')}`)
  }

  // Temps
  const maxMinutes = ctx.isWeekend ? profile.maxMinutesWeekend : profile.maxMinutesWeekday
  if (a.totalMinutes > maxMinutes) {
    score -= 1.5 * Math.min(1, (a.totalMinutes - maxMinutes) / Math.max(15, maxMinutes))
    cautions.push(`${a.totalMinutes} min, plus que ton temps habituel`)
  } else if (a.totalMinutes <= 20) {
    score += 0.3
    reasons.push({ w: 0.4, text: `Prêt en ${a.totalMinutes} min` })
  }

  // Niveau
  const learning = profile.goals.some((g) => g.goal === 'apprendre')
  const gap = recipe.difficulty - profile.skill - (learning ? 1 : 0)
  if (gap > 0) {
    score -= 0.6 * gap
    cautions.push('Un peu technique')
  }

  // Objectifs
  const pantryInfo = ctx.pantry ? pantryCoverage(recipe, ctx.pantry, catalog, ctx.today) : { ratio: 0, usesExpiring: [] }
  for (const { goal, intensity } of profile.goals) {
    const g = goalScore(goal, a, recipe, ctx, pantryInfo)
    score += g.s * INTENSITY[intensity]
    if (g.reason && g.s > 0) reasons.push({ w: g.s * INTENSITY[intensity], text: g.reason })
    if (g.caution) cautions.push(g.caution)
  }

  // Budget
  if (ctx.targetCostPerServing != null && a.costPerServing.confidence !== 'faible') {
    const over = a.costPerServing.value - ctx.targetCostPerServing
    if (over > 0) score -= Math.min(1.5, over / Math.max(0.5, ctx.targetCostPerServing))
    else score += 0.2
  }

  // Saison (seulement si la recette contient des produits a saisonnalite connue)
  if (profile.preferSeasonal && a.seasonalItems > 0) {
    score += (a.seasonality - 0.6) * 1.6
    if (a.seasonality >= 0.99) reasons.push({ w: 0.3, text: 'De saison' })
  }

  // Stock
  if (pantryInfo.ratio > 0) {
    score += pantryInfo.ratio * 1.2
    if (pantryInfo.ratio >= 0.5) reasons.push({ w: pantryInfo.ratio, text: `${Math.round(pantryInfo.ratio * 100)} % des ingrédients déjà chez toi` })
  }
  if (pantryInfo.usesExpiring.length > 0) {
    score += Math.min(1.5, 0.75 * pantryInfo.usesExpiring.length)
    const names = pantryInfo.usesExpiring.slice(0, 2).map((i) => catalog.ingredients.get(i)?.name.toLowerCase())
    reasons.push({ w: 2, text: `Utilise ${names.join(' et ')} à consommer vite` })
  }

  // Nouveaute / repetition
  const days = ctx.recentlyEaten?.get(adaptedFrom?.id ?? recipe.id)
  if (days != null) score -= 1.5 * Math.max(0, (14 - days) / 14)
  else if (profile.discovery > 0.5) {
    score += 0.3 * profile.discovery
    reasons.push({ w: 0.2, text: 'Nouveau pour toi' })
  }

  if (adaptedFrom) {
    score -= recipe.variant?.confidence === 'faible' ? 0.6 : 0.2
    reasons.push({ w: 0.5, text: 'Version adaptée à ton profil' })
  }

  // Variete : bruit plus large si l'utilisateur aime la decouverte.
  if (ctx.random) score += (ctx.random() - 0.5) * (0.3 + 0.9 * profile.discovery)

  return {
    recipe,
    adaptedFrom,
    score,
    reasons: reasons.sort((x, y) => y.w - x.w).map((r) => r.text).filter((t, i, arr) => arr.indexOf(t) === i).slice(0, 3),
    cautions,
    analysis: a,
  }
}

/** Recette telle qu'elle peut etre proposee a ce profil : originale, adaptee, ou null (impossible). */
export function eligibleVersion(recipe: Recipe, profile: Profile, catalog: Catalog): { recipe: Recipe; adaptedFrom?: Recipe } | null {
  const check = checkRecipe(recipe, profile, catalog)
  if (check.allowed) {
    if (check.omit.length === 0) return { recipe }
    return { recipe: { ...recipe, ingredients: recipe.ingredients.filter((l) => !check.omit.includes(l.ingredientId)) } }
  }
  const adapted = adaptToProfile(recipe, profile, catalog)
  return adapted ? { recipe: adapted, adaptedFrom: recipe } : null
}

export type SuggestOptions = {
  slot?: MealSlot
  limit?: number
  exclude?: Set<string>
  filter?: (r: Recipe, a: RecipeAnalysis) => boolean
}

export function suggestRecipes(ctx: ScoreContext, opts: SuggestOptions = {}): Scored[] {
  const out: Scored[] = []
  for (const base of ctx.catalog.recipes) {
    if (base.variant) continue
    if (opts.exclude?.has(base.id)) continue
    if (opts.slot && !fitsSlot(base, opts.slot)) continue
    const v = eligibleVersion(base, ctx.profile, ctx.catalog)
    if (!v) continue
    if (opts.filter && !opts.filter(v.recipe, analyzeCached(v.recipe, ctx.catalog, ctx.month))) continue
    out.push(scoreRecipe(v.recipe, ctx, v.adaptedFrom))
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 20)
}

/** Generateur pseudo-aleatoire deterministe (mulberry32) : meme graine = meme menu. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
