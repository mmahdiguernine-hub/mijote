import type { MealSlot, PantryItem, PlanEntry, Profile, Recipe, TargetRace, TrainingSession } from './types'
import type { Catalog } from './catalog'
import { analyzeCached } from './analysis'
import { eligibleVersion, scoreRecipe, seededRandom, type ScoreContext } from './scoring'
import { addDays } from './shopping'
import { daysBetween, SLOT_ORDER } from './planner'

// Batch cooking : on cuisine en une session (souvent le dimanche) plusieurs plats qui couvrent les
// repas des jours suivants. Le moteur :
//  1. choisit des recettes qui se conservent (frigo >= 3 jours ou congelables), variees entre elles ;
//  2. les repartit sur les repas libres en respectant la conservation : un repas au-dela de la
//     duree de vie au frigo n'est attribue qu'a un plat congelable (avec la consigne de congeler) ;
//  3. produit le deroule de la session (temps actif / passif, four partage) et les consignes de
//     rangement. Les repas generes sont des entrees de planning normales : la liste de courses
//     se met a jour toute seule (achats rattaches au jour de preparation).

export type BatchSession = { id: string; cookDate: string; entryIds: string[]; recipeIds: string[]; createdAt: string }

export type BatchStep = { at: number; recipeId: string; recipeName: string; text: string; kind: 'actif' | 'passif' }

export type StorageNote = {
  recipeId: string
  recipeName: string
  boxes: number
  servingsPerBox: number
  fridgeUntil: string
  /** Repas dont la portion doit etre congelee le jour meme. */
  freezeFor: string[]
}

export type BatchProposal = {
  session: BatchSession
  entries: PlanEntry[]
  recipes: { recipe: Recipe; baseId: string; meals: number; servings: number }[]
  timeline: BatchStep[]
  storage: StorageNote[]
  totalMinutes: number
  activeMinutes: number
  warnings: string[]
}

export type BatchInput = {
  profile: Profile
  catalog: Catalog
  cookDate: string
  /** Jours couverts (en general cookDate..cookDate+3 ou +4). */
  dates: string[]
  slots?: MealSlot[]
  existing: PlanEntry[]
  recipeCount?: number
  pantry?: PantryItem[]
  sessions?: TrainingSession[]
  races?: TargetRace[]
  history?: PlanEntry[]
  today?: string
  seed?: number
  idFactory?: () => string
}

const MAIN_PROTEIN = ['volaille', 'viande_rouge', 'porc', 'charcuterie', 'poisson', 'fruits_de_mer', 'proteine_vegetale', 'legumineuse', 'oeuf'] as const

let n = 0
const defaultId = () => `b${Date.now().toString(36)}${(n++).toString(36)}`

/** Le plat peut-il etre mange `daysAfter` jours apres la preparation, et faut-il le congeler ? */
export function storageFor(recipe: Recipe, daysAfter: number): 'frigo' | 'congelateur' | null {
  if (daysAfter <= recipe.storage.fridgeDays) return 'frigo'
  return recipe.storage.freezable ? 'congelateur' : null
}

export function proposeBatch(input: BatchInput): BatchProposal {
  const { profile, catalog, cookDate } = input
  const makeId = input.idFactory ?? defaultId
  const random = seededRandom(input.seed ?? 11)
  const warnings: string[] = []
  const household = Math.max(1, profile.householdSize)
  const slots = (input.slots ?? profile.slots.filter((s) => s === 'dejeuner' || s === 'diner')).slice().sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b))

  // 1. Repas libres
  const free: { date: string; slot: MealSlot }[] = []
  for (const date of input.dates) {
    for (const slot of slots) {
      if (date === cookDate && slot === 'dejeuner') continue // on cuisine en general ce midi-la
      if (!input.existing.some((e) => e.date === date && e.slot === slot)) free.push({ date, slot })
    }
  }
  const sessionId = makeId()
  if (free.length < 2) {
    return { session: { id: sessionId, cookDate, entryIds: [], recipeIds: [], createdAt: new Date().toISOString() }, entries: [], recipes: [], timeline: [], storage: [], totalMinutes: 0, activeMinutes: 0, warnings: ['Pas assez de repas libres sur la période pour un batch cooking.'] }
  }

  // 2. Recettes candidates
  const k = Math.min(input.recipeCount ?? Math.max(2, Math.min(4, Math.round(free.length / 3))), free.length)
  const recent = new Map<string, number>()
  for (const h of input.history ?? []) if (h.recipeId) recent.set(h.recipeId, Math.min(recent.get(h.recipeId) ?? 99, Math.abs(daysBetween(h.date, cookDate))))
  const ctx: ScoreContext = { profile, catalog, pantry: input.pantry, today: input.today, recentlyEaten: recent, isWeekend: true, random, month: Number(cookDate.slice(5, 7)) }
  const lastDay = Math.max(...free.map((f) => daysBetween(cookDate, f.date)))

  const candidates = catalog.recipes
    .filter((r) => !r.variant && ['plat', 'soupe', 'salade'].includes(r.course) && r.slots.some((s) => s === 'dejeuner' || s === 'diner'))
    .filter((r) => r.storage.fridgeDays >= 3 || r.storage.freezable)
    .flatMap((base) => {
      const v = eligibleVersion(base, profile, catalog)
      if (!v) return []
      const s = scoreRecipe(v.recipe, ctx, v.adaptedFrom)
      let score = s.score
      if (base.tags.includes('batch')) score += 1
      if (base.storage.freezable) score += 0.3
      if (base.storage.fridgeDays < lastDay && !base.storage.freezable) score -= 1
      if (profile.sport?.enabled && base.tags.includes('sport')) score += 0.5
      return [{ base, recipe: v.recipe, score, protein: MAIN_PROTEIN.find((t) => analyzeCached(v.recipe, catalog).tags.has(t)) ?? null }]
    })
    .sort((a, b) => b.score - a.score)

  const chosen: typeof candidates = []
  for (const c of candidates) {
    if (chosen.length >= k) break
    if (chosen.some((x) => x.protein && x.protein === c.protein)) continue
    if (chosen.some((x) => x.base.course === c.base.course && c.base.course !== 'plat')) continue
    if (chosen.some((x) => x.base.cuisine && x.base.cuisine === c.base.cuisine)) continue
    chosen.push(c)
  }
  for (const c of candidates) if (chosen.length < k && !chosen.includes(c)) chosen.push(c)
  if (chosen.length === 0) {
    warnings.push('Aucune recette compatible avec ton profil ne se conserve assez longtemps.')
    return { session: { id: sessionId, cookDate, entryIds: [], recipeIds: [], createdAt: new Date().toISOString() }, entries: [], recipes: [], timeline: [], storage: [], totalMinutes: 0, activeMinutes: 0, warnings }
  }

  // 3. Repartition des repas (quotas equilibres, conservation respectee, pas deux fois de suite)
  const quota = chosen.map((_, i) => Math.floor(free.length / chosen.length) + (i < free.length % chosen.length ? 1 : 0))
  const assigned: number[][] = chosen.map(() => [])
  let prev = -1
  free.forEach((meal, mi) => {
    const after = daysBetween(cookDate, meal.date)
    const options = chosen
      .map((c, i) => ({ i, store: storageFor(c.base, after) }))
      .filter((o) => o.store && assigned[o.i].length < quota[o.i])
    if (options.length === 0) {
      // Quota atteint partout ou rien ne se conserve : on prend un plat congelable s'il existe.
      const fallback = chosen.findIndex((c) => storageFor(c.base, after))
      if (fallback >= 0) assigned[fallback].push(mi)
      else warnings.push(`Aucun plat ne se conserve jusqu’au ${meal.date} : repas laissé libre.`)
      return
    }
    // Priorite : ce qui se garde le moins longtemps au frigo, et pas le meme plat qu'au repas precedent.
    options.sort((a, b) => Number(a.i === prev) - Number(b.i === prev) || chosen[a.i].base.storage.fridgeDays - chosen[b.i].base.storage.fridgeDays)
    assigned[options[0].i].push(mi)
    prev = options[0].i
  })

  // 4. Entrees de planning
  const entries: PlanEntry[] = []
  const recipes: BatchProposal['recipes'] = []
  const storage: StorageNote[] = []
  chosen.forEach((c, i) => {
    const meals = assigned[i].map((mi) => free[mi])
    if (meals.length === 0) return
    const variant = c.recipe.variant?.kind
    const firstId = makeId()
    entries.push({ id: firstId, date: meals[0].date, slot: meals[0].slot, kind: 'recette', recipeId: c.base.id, variant, servings: household * meals.length, leftoverServings: meals.length > 1 ? household * (meals.length - 1) : undefined, cookOn: cookDate, batchId: sessionId })
    for (const m of meals.slice(1)) {
      entries.push({ id: makeId(), date: m.date, slot: m.slot, kind: 'reste', recipeId: c.base.id, variant, leftoverOf: firstId, servings: household, cookOn: cookDate, batchId: sessionId })
    }
    recipes.push({ recipe: c.recipe, baseId: c.base.id, meals: meals.length, servings: household * meals.length })
    storage.push({
      recipeId: c.base.id, recipeName: c.recipe.name, boxes: meals.length, servingsPerBox: household,
      fridgeUntil: addDays(cookDate, c.base.storage.fridgeDays),
      freezeFor: meals.filter((m) => storageFor(c.base, daysBetween(cookDate, m.date)) === 'congelateur').map((m) => m.date),
    })
  })

  const { timeline, totalMinutes, activeMinutes } = batchTimeline(recipes.map((r) => ({ recipe: r.recipe, baseId: r.baseId, factor: r.servings / r.recipe.servings })))
  if (recipes.filter((r) => r.recipe.equipment.includes('four')).length > 1) warnings.push('Plusieurs plats passent au four : enfourne-les ensemble si la température est proche.')
  if (recipes.some((r) => r.servings / r.recipe.servings >= 2)) warnings.push('Grandes quantités : prévois de grandes casseroles, les cuissons peuvent être un peu plus longues.')

  return {
    session: { id: sessionId, cookDate, entryIds: entries.map((e) => e.id), recipeIds: recipes.map((r) => r.baseId), createdAt: new Date().toISOString() },
    entries, recipes, timeline, storage, totalMinutes, activeMinutes, warnings,
  }
}

/**
 * Deroule de la session : les plats les plus longs a cuire commencent en premier ; pendant qu'un
 * plat mijote (temps passif), on prepare le suivant. Estimation, a ajuster selon la cuisine.
 */
export function batchTimeline(items: { recipe: Recipe; baseId: string; factor: number }[]): { timeline: BatchStep[]; totalMinutes: number; activeMinutes: number } {
  const ordered = [...items].sort((a, b) => b.recipe.cookMinutes - a.recipe.cookMinutes)
  const timeline: BatchStep[] = []
  let cursor = 0
  let end = 0
  let active = 0
  for (const { recipe, baseId, factor } of ordered) {
    // Plus de quantite = plus d'epluchage : +30 % de preparation par doublement, plafonne.
    const prep = Math.round(recipe.prepMinutes * Math.min(2, 1 + 0.3 * Math.log2(Math.max(1, factor))))
    timeline.push({ at: cursor, recipeId: baseId, recipeName: recipe.name, kind: 'actif', text: `Préparer : ${recipe.steps[0] ?? 'éplucher et couper les ingrédients'}` })
    cursor += prep
    active += prep
    if (recipe.cookMinutes > 0) {
      timeline.push({ at: cursor, recipeId: baseId, recipeName: recipe.name, kind: 'passif', text: `Lancer la cuisson (${recipe.cookMinutes} min)${recipe.equipment.includes('four') ? ' au four' : ''} : ${recipe.steps.slice(1, 3).join(' ') || 'surveiller de temps en temps.'}` })
      end = Math.max(end, cursor + recipe.cookMinutes)
    }
    end = Math.max(end, cursor)
  }
  const finish = Math.max(end, cursor)
  timeline.push({ at: finish, recipeId: '', recipeName: 'Rangement', kind: 'actif', text: 'Laisser tiédir, répartir en boîtes étiquetées (plat + date), frigo ou congélateur selon le plan de rangement.' })
  return { timeline, totalMinutes: finish + 15, activeMinutes: active + 15 }
}
