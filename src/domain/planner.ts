import type { MealSlot, PantryItem, PlanEntry, Profile, Recipe } from './types'
import type { Catalog } from './catalog'
import { analyzeCached } from './analysis'
import { scoreRecipe, eligibleVersion, fitsSlot, seededRandom, type Scored, type ScoreContext } from './scoring'
import { aggregateNeeds, addDays, choosePackages, type MealNeed } from './shopping'
import { resolveRecipe } from './variants'

// Planning automatique. Glouton et deterministe (graine) : pour chaque creneau libre, dans l'ordre
// chronologique, on classe les recettes eligibles avec le scoring du profil + des criteres propres
// au planning (repetition, reutilisation des conditionnements entames, budget restant, restes).
// L'utilisateur garde la main : les repas verrouilles et ceux deja choisis a la main (option
// keepExisting) ne sont jamais touches, et chaque repas peut ensuite etre remplace ou deplace.

export const SLOT_LABEL: Record<MealSlot, string> = {
  petit_dejeuner: 'Petit-déjeuner', dejeuner: 'Déjeuner', diner: 'Dîner', collation: 'Collation',
}
export const SLOT_ORDER: MealSlot[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']

export type GenerateInput = {
  profile: Profile
  catalog: Catalog
  dates: string[]
  slots?: MealSlot[]
  existing: PlanEntry[]
  /** Si vrai, toute entree existante est conservee ; sinon seules les verrouillees. */
  keepExisting?: boolean
  pantry?: PantryItem[]
  /** Planning passe, pour eviter de reproposer ce qu'on vient de manger. */
  history?: PlanEntry[]
  today?: string
  seed?: number
  /** Budget pour la periode (sinon deduit du profil). */
  budget?: number
  idFactory?: () => string
}

export type GenerateResult = { entries: PlanEntry[]; warnings: string[] }

export function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 || day === 6
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

/** Budget de la periode a partir du profil (mensuel ramene a la semaine sur 4,33 semaines). */
export function budgetForDates(profile: Profile, dates: string[]): number | undefined {
  if (!profile.budget) return undefined
  const perDay = profile.budget.period === 'semaine' ? profile.budget.amount / 7 : profile.budget.amount / 30.4
  return perDay * dates.length
}

let counter = 0
const defaultId = () => `e${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

const MAIN_PROTEIN_TAGS = ['volaille', 'viande_rouge', 'porc', 'charcuterie', 'poisson', 'fruits_de_mer', 'proteine_vegetale', 'legumineuse', 'oeuf'] as const

function mainProtein(recipe: Recipe, catalog: Catalog): string | null {
  const a = analyzeCached(recipe, catalog)
  return MAIN_PROTEIN_TAGS.find((t) => a.tags.has(t)) ?? null
}

/** Restes de conditionnements entames par le planning en cours (ingredient -> quantite restante). */
function openedPackages(meals: MealNeed[], catalog: Catalog): Map<string, number> {
  const out = new Map<string, number>()
  for (const a of aggregateNeeds(meals, catalog).values()) {
    if (!a.ing.packages || a.ing.staple || a.needed <= 0) continue
    // Seuls les produits frais comptent : un paquet de riz entame ne se perd pas.
    if ((a.ing.shelfLifeDays ?? 365) > 10) continue
    const p = choosePackages(a.needed, a.ing.packages)
    if (p && p.leftover > 0) out.set(a.ing.id, p.leftover)
  }
  return out
}

export function generatePlan(input: GenerateInput): GenerateResult {
  const { profile, catalog, dates } = input
  const slots = (input.slots ?? profile.slots).slice().sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b))
  const random = seededRandom(input.seed ?? 1)
  const makeId = input.idFactory ?? defaultId
  const warnings: string[] = []
  const servings = Math.max(1, profile.householdSize)
  const dateSet = new Set(dates)

  // Entrees conservees telles quelles
  const kept = input.existing.filter((e) => dateSet.has(e.date) && (input.keepExisting || e.locked || e.kind === 'exterieur'))
  const outside = input.existing.filter((e) => !dateSet.has(e.date))
  const entries: PlanEntry[] = [...kept]
  const taken = (date: string, slot: MealSlot) => entries.some((e) => e.date === date && e.slot === slot)

  const variantCtx = { catalog, profile, pantry: input.pantry }
  const plannedMeals = (): MealNeed[] =>
    entries.flatMap((e) => {
      const r = e.kind === 'recette' && e.recipeId ? catalog.recipesById.get(e.recipeId) : undefined
      return r ? [{ recipe: resolveRecipe(r, e.variant, variantCtx), servings: e.servings, date: e.date, entryId: e.id }] : []
    })

  const budget = input.budget ?? budgetForDates(profile, dates)
  const totalSlots = dates.length * slots.length
  const firstDate = dates[0]

  // Historique : jours depuis le dernier passage de chaque recette
  const recent = new Map<string, number>()
  for (const h of input.history ?? []) {
    if (h.kind !== 'recette' || !h.recipeId || !firstDate) continue
    const d = daysBetween(h.date, firstDate)
    if (d >= 0 && (!recent.has(h.recipeId) || d < recent.get(h.recipeId)!)) recent.set(h.recipeId, d)
  }

  // Pre-calcul des versions eligibles par recette (contraintes strictes appliquees une fois)
  const eligible: { base: Recipe; version: NonNullable<ReturnType<typeof eligibleVersion>> }[] = []
  for (const base of catalog.recipes) {
    if (base.variant) continue
    const v = eligibleVersion(base, profile, catalog)
    if (v) eligible.push({ base, version: v })
  }

  const batchFriendly = profile.leftoversOk && profile.cookingStyle !== 'chaque_jour'

  for (const date of dates) {
    for (const slot of slots) {
      if (taken(date, slot)) continue

      const meals = plannedMeals()
      const spent = meals.reduce((s, m) => s + analyzeCached(m.recipe, catalog).costPerServing.value * m.servings, 0)
      const filled = entries.filter((e) => dateSet.has(e.date)).length
      const remainingSlots = Math.max(1, totalSlots - filled)
      const targetCostPerServing = budget != null ? Math.max(0.5, (budget - spent) / remainingSlots / servings) : undefined
      const opened = openedPackages(meals, catalog)

      const inPlan = new Map<string, number>()
      for (const e of entries) if (e.recipeId) inPlan.set(e.recipeId, Math.min(inPlan.get(e.recipeId) ?? 99, Math.abs(daysBetween(e.date, date))))
      const recentlyEaten = new Map(recent)
      for (const [id, d] of inPlan) recentlyEaten.set(id, Math.min(d, recentlyEaten.get(id) ?? 99))

      const prev = [...entries].filter((e) => e.kind === 'recette' && e.date <= date).sort((a, b) => (a.date + SLOT_ORDER.indexOf(a.slot)).localeCompare(b.date + SLOT_ORDER.indexOf(b.slot))).at(-1)
      const prevRecipe = prev?.recipeId ? catalog.recipesById.get(prev.recipeId) : undefined
      const prevProtein = prevRecipe ? mainProtein(prevRecipe, catalog) : null

      const nearbyCourses = new Map<string, number>()
      const nearbyCuisines = new Map<string, number>()
      const nearbyProteins = new Map<string, number>()
      for (const e of entries) {
        if (e.kind !== 'recette' || !e.recipeId || Math.abs(daysBetween(e.date, date)) > 3) continue
        const r = catalog.recipesById.get(e.recipeId)
        if (!r) continue
        nearbyCourses.set(r.course, (nearbyCourses.get(r.course) ?? 0) + 1)
        if (r.cuisine) nearbyCuisines.set(r.cuisine, (nearbyCuisines.get(r.cuisine) ?? 0) + 1)
        const prot = mainProtein(r, catalog)
        if (prot) nearbyProteins.set(prot, (nearbyProteins.get(prot) ?? 0) + 1)
      }

      const ctx: ScoreContext = {
        profile, catalog, pantry: input.pantry, today: input.today, recentlyEaten, isWeekend: isWeekend(date),
        targetCostPerServing, random, month: Number(date.slice(5, 7)),
      }

      let best: (Scored & { base: Recipe }) | null = null
      for (const { base, version } of eligible) {
        if (!fitsSlot(base, slot)) continue
        const s = scoreRecipe(version.recipe, ctx, version.adaptedFrom) as Scored & { base: Recipe }
        s.base = base
        if (inPlan.has(base.id)) s.score -= 3 // jamais deux fois la meme recette dans la periode, sauf a court d'options
        const prot = mainProtein(version.recipe, catalog)
        if (prevProtein && prot === prevProtein) s.score -= 0.4
        if (prot && (nearbyProteins.get(prot) ?? 0) >= 2) s.score -= 0.5 * ((nearbyProteins.get(prot) ?? 0) - 1)
        // Variete du type de plat : pas quatre soupes dans la semaine.
        if (base.course !== 'plat') s.score -= 0.7 * (nearbyCourses.get(base.course) ?? 0)
        if (base.cuisine && (nearbyCuisines.get(base.cuisine) ?? 0) >= 2) s.score -= 0.3
        let reuse = 0
        for (const l of version.recipe.ingredients) if (opened.has(l.ingredientId)) reuse++
        if (reuse > 0) {
          s.score += Math.min(0.9, 0.3 * reuse)
          s.reasons = ['Réutilise des produits déjà achetés pour la semaine', ...s.reasons].slice(0, 3)
        }
        if (batchFriendly && version.recipe.tags.includes('batch')) s.score += profile.cookingStyle === 'batch' ? 0.6 : 0.3
        if (!best || s.score > best.score) best = s
      }

      if (!best) {
        warnings.push(`Aucune recette compatible pour ${SLOT_LABEL[slot].toLowerCase()} le ${date}.`)
        continue
      }

      const entry: PlanEntry = {
        id: makeId(),
        date,
        slot,
        kind: 'recette',
        recipeId: best.base.id,
        variant: best.adaptedFrom ? best.recipe.variant?.kind : undefined,
        servings,
      }

      // Restes : un diner qui se conserve est cuisine en double pour le dejeuner du lendemain.
      const next = addDays(date, 1)
      if (
        batchFriendly && slot === 'diner' && best.recipe.storage.fridgeDays >= 2 && slots.includes('dejeuner') &&
        dateSet.has(next) && !taken(next, 'dejeuner')
      ) {
        entry.servings = servings * 2
        entry.leftoverServings = servings
        entries.push(entry)
        entries.push({ id: makeId(), date: next, slot: 'dejeuner', kind: 'reste', leftoverOf: entry.id, recipeId: best.base.id, variant: entry.variant, servings })
        continue
      }
      entries.push(entry)
    }
  }

  const finalMeals = plannedMeals().filter((m) => m.date && dateSet.has(m.date))
  if (budget != null) {
    const est = finalMeals.reduce((s, m) => s + analyzeCached(m.recipe, catalog).cost.value * (m.servings / m.recipe.servings), 0)
    if (est > budget * 1.05) warnings.push(`Le menu coûte environ ${Math.round(est)} € pour un budget de ${Math.round(budget)} € (estimations).`)
  }

  return { entries: [...outside, ...entries], warnings }
}

/** Alternatives pour remplacer un repas, dans le contexte du planning courant. */
export function alternativesFor(
  entry: PlanEntry,
  plan: PlanEntry[],
  input: Pick<GenerateInput, 'profile' | 'catalog' | 'pantry' | 'today' | 'history'> & { limit?: number; seed?: number; filter?: (r: Recipe) => boolean },
): Scored[] {
  const { profile, catalog } = input
  const random = seededRandom(input.seed ?? 7)
  const recentlyEaten = new Map<string, number>()
  for (const e of [...(input.history ?? []), ...plan]) {
    if (!e.recipeId || e.id === entry.id) continue
    const d = Math.abs(daysBetween(e.date, entry.date))
    recentlyEaten.set(e.recipeId, Math.min(d, recentlyEaten.get(e.recipeId) ?? 99))
  }
  const ctx: ScoreContext = { profile, catalog, pantry: input.pantry, today: input.today, recentlyEaten, isWeekend: isWeekend(entry.date), random, month: Number(entry.date.slice(5, 7)) }
  const out: Scored[] = []
  for (const base of catalog.recipes) {
    if (base.variant || base.id === entry.recipeId || !fitsSlot(base, entry.slot)) continue
    const v = eligibleVersion(base, profile, catalog)
    if (!v) continue
    if (input.filter && !input.filter(v.recipe)) continue
    out.push(scoreRecipe(v.recipe, ctx, v.adaptedFrom))
  }
  return out.sort((a, b) => b.score - a.score).slice(0, input.limit ?? 6)
}

/** Remplace la recette d'un repas. Les restes lies suivent la nouvelle recette si elle se conserve, sinon disparaissent. */
export function replaceRecipe(plan: PlanEntry[], entryId: string, recipe: Recipe, catalog: Catalog): PlanEntry[] {
  const baseId = recipe.baseRecipeId ?? recipe.id
  const variant = recipe.variant?.kind
  const base = catalog.recipesById.get(baseId)
  const storable = (base ?? recipe).storage.fridgeDays >= 2
  return plan.flatMap((e) => {
    if (e.id === entryId) {
      const updated: PlanEntry = { ...e, kind: 'recette', recipeId: baseId, variant, leftoverOf: undefined }
      if (!storable && e.leftoverServings) {
        updated.servings = e.servings - e.leftoverServings
        updated.leftoverServings = undefined
      }
      return [updated]
    }
    if (e.leftoverOf === entryId) return storable ? [{ ...e, recipeId: baseId, variant }] : []
    return [e]
  })
}

/** Supprime un repas ; un repas cuisine emporte ses restes, un reste supprime reduit les portions cuisinees. */
export function removeEntry(plan: PlanEntry[], entryId: string): PlanEntry[] {
  const target = plan.find((e) => e.id === entryId)
  if (!target) return plan
  return plan.flatMap((e) => {
    if (e.id === entryId || e.leftoverOf === entryId) return []
    if (target.kind === 'reste' && e.id === target.leftoverOf) {
      const left = Math.max(0, (e.leftoverServings ?? 0) - target.servings)
      return [{ ...e, servings: e.servings - target.servings, leftoverServings: left || undefined }]
    }
    return [e]
  })
}

/**
 * Deplace un repas vers un autre creneau (echange si occupe). Un reste ne peut pas preceder le
 * repas dont il provient : dans ce cas, il est supprime et les portions en trop retirees.
 */
export function moveEntry(plan: PlanEntry[], entryId: string, toDate: string, toSlot: MealSlot): PlanEntry[] {
  const moving = plan.find((e) => e.id === entryId)
  if (!moving) return plan
  const occupant = plan.find((e) => e.date === toDate && e.slot === toSlot && e.id !== entryId)
  let next = plan.map((e) => {
    if (e.id === entryId) return { ...e, date: toDate, slot: toSlot }
    if (occupant && e.id === occupant.id) return { ...e, date: moving.date, slot: moving.slot }
    return e
  })
  next = normalizeLeftovers(next)
  return next
}

const slotKey = (e: PlanEntry) => `${e.date}#${SLOT_ORDER.indexOf(e.slot)}`

export function normalizeLeftovers(plan: PlanEntry[]): PlanEntry[] {
  let out = plan
  for (const e of plan) {
    if (e.kind !== 'reste') continue
    const source = out.find((s) => s.id === e.leftoverOf)
    if (!source || slotKey(source) >= slotKey(e)) out = removeEntry(out, e.id)
  }
  return out
}

/** Ajoute un repas a un creneau (remplace l'occupant s'il y en a un). */
export function setMeal(plan: PlanEntry[], entry: PlanEntry): PlanEntry[] {
  const occupant = plan.find((e) => e.date === entry.date && e.slot === entry.slot)
  const cleared = occupant ? removeEntry(plan, occupant.id) : plan
  return [...cleared, entry]
}

/** Change le nombre de portions d'un repas cuisine (les portions de reste restent incluses). */
export function setServings(plan: PlanEntry[], entryId: string, servings: number): PlanEntry[] {
  return plan.map((e) => (e.id === entryId ? { ...e, servings: Math.max((e.leftoverServings ?? 0) + 1, Math.round(servings)) } : e))
}

/** Dates AAAA-MM-JJ du lundi au dimanche de la semaine contenant `iso`. */
export function weekDates(iso: string): string[] {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const offset = (date.getUTCDay() + 6) % 7
  const monday = addDays(iso, -offset)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
