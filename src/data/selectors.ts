import type { Catalog } from '@/domain/catalog'
import type { ShoppingListMeta } from '@/domain/types'
import { buildShoppingList, mealsFromPlan, type ShoppingList } from '@/domain/shopping'
import { resolveRecipe } from '@/domain/variants'
import { weekDates } from '@/domain/planner'
import { analyzeCached } from '@/domain/analysis'
import { weekListId, type UserState } from './state'

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

/** Liste "de la semaine" : toujours disponible, sans avoir a la creer. */
export function weekListMeta(anyDayIso: string): ShoppingListMeta {
  const days = weekDates(anyDayIso)
  return { id: weekListId(days[0]), name: `Semaine du ${fmtDay(days[0])}`, mode: 'semaine', from: days[0], to: days[6], createdAt: days[0] }
}

export type ComputedList = ShoppingList & { meta: ShoppingListMeta; excludedPast: number; missingRecipes: string[] }

/**
 * Liste de courses d'une liste donnee, recalculee a chaque appel depuis le planning, le stock et
 * les ajouts manuels. Les repas deja cuisines et ceux des jours passes ne sont pas comptes.
 */
export function computeList(state: UserState, catalog: Catalog, meta: ShoppingListMeta, today: string): ComputedList {
  const ctx = { catalog, profile: state.profile ?? undefined, pantry: state.pantry }
  let meals: ReturnType<typeof mealsFromPlan>['meals'] = []
  let missingRecipes: string[] = []
  let excludedPast = 0

  if ((meta.mode === 'semaine' || meta.mode === 'periode') && meta.from && meta.to) {
    const from = meta.from < today ? today : meta.from
    const relevant = state.plan.filter((e) => !e.cookedAt)
    excludedPast = state.plan.filter((e) => e.kind === 'recette' && !e.cookedAt && e.date >= meta.from! && e.date < from).length
    const r = mealsFromPlan(relevant, ctx, { from, to: meta.to })
    meals = r.meals
    missingRecipes = r.missingRecipes
  } else if (meta.mode === 'recette' && meta.recipeId) {
    const base = catalog.recipesById.get(meta.recipeId)
    if (base) meals = [{ recipe: resolveRecipe(base, undefined, ctx), servings: meta.servings ?? base.servings }]
    else missingRecipes = [meta.recipeId]
  }

  const manual = state.manual.filter((m) => m.listId === meta.id || (m.listId == null && m.recurring && meta.mode === 'semaine'))
  const list = buildShoppingList(meals, { catalog, pantry: state.pantry, manual, overrides: state.overrides[meta.id] ?? [], today })
  return { ...list, meta, excludedPast, missingRecipes }
}

/** Apports estimes des repas planifies un jour donne, pour UNE personne (une portion par repas). */
export function plannedIntake(state: UserState, catalog: Catalog, date: string): { kcal: number; carbs: number; protein: number; fat: number; meals: number; confidence: 'haute' | 'moyenne' | 'faible' } {
  const ctx = { catalog, profile: state.profile ?? undefined, pantry: state.pantry }
  let kcal = 0, carbs = 0, protein = 0, fat = 0, meals = 0
  let low = false
  for (const e of state.plan) {
    if (e.date !== date || e.kind === 'exterieur' || !e.recipeId) continue
    const base = catalog.recipesById.get(e.recipeId)
    if (!base) continue
    const a = analyzeCached(resolveRecipe(base, e.variant, ctx), catalog)
    kcal += a.nutrition.value.kcal
    carbs += a.nutrition.value.carbs
    protein += a.nutrition.value.protein
    fat += a.nutrition.value.fat
    if (a.nutrition.confidence === 'faible') low = true
    meals++
  }
  return { kcal: Math.round(kcal), carbs: Math.round(carbs), protein: Math.round(protein), fat: Math.round(fat), meals, confidence: low ? 'faible' : 'moyenne' }
}
