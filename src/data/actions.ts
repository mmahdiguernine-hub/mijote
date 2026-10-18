import type { Catalog } from '@/domain/catalog'
import type { ManualShoppingItem, MealSlot, PantryItem, PlanEntry, Profile, Recipe, ShoppingListMeta, ShoppingOverride, TrainingSession } from '@/domain/types'
import type { ShoppingLine } from '@/domain/shopping'
import { generatePlan, moveEntry, removeEntry, replaceRecipe, setMeal, setServings } from '@/domain/planner'
import { consumeRecipe, addPurchases } from '@/domain/pantry'
import { resolveRecipe } from '@/domain/variants'
import { newId, type StoredRace, type UserState } from './state'
import type { BatchProposal } from '@/domain/batch'

// Toutes les modifications de l'etat utilisateur, en fonctions pures (etat -> nouvel etat).
// Les ecrans et l'assistant appellent les memes fonctions : une seule logique metier.

export function setProfile(s: UserState, profile: Profile): UserState {
  return { ...s, profile }
}

export function generateDays(
  s: UserState,
  catalog: Catalog,
  dates: string[],
  opts: { keepExisting?: boolean; seed?: number; today: string },
): { state: UserState; warnings: string[] } {
  if (!s.profile) return { state: s, warnings: ['Profil manquant'] }
  const history = s.plan.filter((e) => e.date < (dates[0] ?? opts.today))
  const { entries, warnings } = generatePlan({
    profile: s.profile, catalog, dates, existing: s.plan, keepExisting: opts.keepExisting, pantry: s.pantry,
    history, today: opts.today, seed: opts.seed ?? Date.now() % 100000, idFactory: () => newId('e'),
    sessions: s.training, races: s.races,
  })
  return { state: { ...s, plan: entries }, warnings }
}

export function replaceMeal(s: UserState, entryId: string, recipe: Recipe, catalog: Catalog): UserState {
  return { ...s, plan: replaceRecipe(s.plan, entryId, recipe, catalog) }
}

export function removeMeal(s: UserState, entryId: string): UserState {
  return { ...s, plan: removeEntry(s.plan, entryId) }
}

export function moveMeal(s: UserState, entryId: string, date: string, slot: MealSlot): UserState {
  return { ...s, plan: moveEntry(s.plan, entryId, date, slot) }
}

export function addMeal(s: UserState, date: string, slot: MealSlot, recipe: Recipe, servings: number): UserState {
  const entry: PlanEntry = {
    id: newId('e'), date, slot, kind: 'recette', recipeId: recipe.baseRecipeId ?? recipe.id, variant: recipe.variant?.kind, servings,
  }
  return { ...s, plan: setMeal(s.plan, entry) }
}

export function setEatingOut(s: UserState, date: string, slot: MealSlot): UserState {
  const servings = s.profile?.householdSize ?? 1
  return { ...s, plan: setMeal(s.plan, { id: newId('e'), date, slot, kind: 'exterieur', servings }) }
}

export function setMealServings(s: UserState, entryId: string, servings: number): UserState {
  return { ...s, plan: setServings(s.plan, entryId, servings) }
}

export function toggleLock(s: UserState, entryId: string): UserState {
  return { ...s, plan: s.plan.map((e) => (e.id === entryId ? { ...e, locked: !e.locked } : e)) }
}

/** "J'ai cuisine ce repas" : le stock est deduit, le repas marque comme fait (et retire des courses). */
export function markCooked(s: UserState, entryId: string, catalog: Catalog): UserState {
  const e = s.plan.find((x) => x.id === entryId)
  if (!e || e.kind !== 'recette' || !e.recipeId || e.cookedAt) return s
  const base = catalog.recipesById.get(e.recipeId)
  if (!base) return s
  const recipe = resolveRecipe(base, e.variant, { catalog, profile: s.profile ?? undefined })
  return {
    ...s,
    pantry: consumeRecipe(s.pantry, recipe, e.servings, catalog),
    plan: s.plan.map((x) => (x.id === entryId ? { ...x, cookedAt: new Date().toISOString() } : x)),
  }
}

// --- Stock ---------------------------------------------------------------------------------

export function upsertPantry(s: UserState, item: PantryItem): UserState {
  const exists = s.pantry.some((p) => p.id === item.id)
  return { ...s, pantry: exists ? s.pantry.map((p) => (p.id === item.id ? item : p)) : [...s.pantry, item] }
}

export function removePantry(s: UserState, id: string): UserState {
  return { ...s, pantry: s.pantry.filter((p) => p.id !== id) }
}

// --- Courses -------------------------------------------------------------------------------

function patchOverride(s: UserState, listId: string, key: string, patch: Partial<ShoppingOverride>): UserState {
  const list = s.overrides[listId] ?? []
  const current = list.find((o) => o.key === key) ?? { key }
  const next = { ...current, ...patch }
  const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) as ShoppingOverride
  const isEmpty = Object.keys(cleaned).length === 1
  const others = list.filter((o) => o.key !== key)
  return { ...s, overrides: { ...s.overrides, [listId]: isEmpty ? others : [...others, cleaned] } }
}

export function toggleChecked(s: UserState, listId: string, line: ShoppingLine): UserState {
  return patchOverride(s, listId, line.key, { checked: !line.checked })
}

export function removeLine(s: UserState, listId: string, key: string): UserState {
  return patchOverride(s, listId, key, { removed: true })
}

export function restoreLine(s: UserState, listId: string, key: string): UserState {
  return patchOverride(s, listId, key, { removed: undefined })
}

export function setLineQuantity(s: UserState, listId: string, key: string, quantity: number | undefined): UserState {
  return patchOverride(s, listId, key, { quantityOverride: quantity })
}

export function addManualItem(s: UserState, item: Omit<ManualShoppingItem, 'id'>): UserState {
  return { ...s, manual: [...s.manual, { ...item, id: newId('m') }] }
}

export function removeManualItem(s: UserState, id: string, listId: string): UserState {
  const item = s.manual.find((m) => m.id === id)
  // Un article recurrent retire d'une liste reste recurrent : on le masque seulement pour cette liste.
  if (item?.recurring && item.listId == null) return patchOverride(s, listId, `manuel:${id}`, { removed: true })
  return { ...s, manual: s.manual.filter((m) => m.id !== id) }
}

export function setRecurring(s: UserState, id: string, recurring: boolean, listId: string): UserState {
  return { ...s, manual: s.manual.map((m) => (m.id === id ? { ...m, recurring, listId: recurring ? null : listId } : m)) }
}

/**
 * "Courses faites" : les articles coches rejoignent le stock (avec une date de peremption estimee
 * pour les produits frais), les coches sont remises a zero et les ajouts ponctuels coches retires.
 */
export function finishShopping(s: UserState, listId: string, lines: ShoppingLine[], catalog: Catalog, today: string): UserState {
  const checked = lines.filter((l) => l.checked)
  const pantry = addPurchases(s.pantry, checked, catalog, today, () => newId('p'))
  const checkedManualIds = new Set(checked.flatMap((l) => l.manualIds))
  const manual = s.manual.filter((m) => !(checkedManualIds.has(m.id) && !m.recurring))
  const overrides = (s.overrides[listId] ?? []).map((o) => ({ ...o, checked: undefined })).filter((o) => o.removed || o.quantityOverride != null || o.store)
  return { ...s, pantry, manual, overrides: { ...s.overrides, [listId]: overrides } }
}

export function createList(s: UserState, meta: Omit<ShoppingListMeta, 'id' | 'createdAt'>): { state: UserState; id: string } {
  const id = newId('l')
  return { state: { ...s, lists: [...s.lists, { ...meta, id, createdAt: new Date().toISOString() }] }, id }
}

export function deleteList(s: UserState, id: string): UserState {
  const { [id]: _removed, ...overrides } = s.overrides
  void _removed
  return { ...s, lists: s.lists.filter((l) => l.id !== id), manual: s.manual.filter((m) => m.listId !== id), overrides }
}

// --- Sport ---------------------------------------------------------------------------------

export function upsertSession(s: UserState, session: TrainingSession): UserState {
  const exists = s.training.some((x) => x.id === session.id)
  return { ...s, training: exists ? s.training.map((x) => (x.id === session.id ? session : x)) : [...s.training, session] }
}

export function removeSession(s: UserState, id: string): UserState {
  return { ...s, training: s.training.filter((x) => x.id !== id) }
}

export function upsertRace(s: UserState, race: StoredRace): UserState {
  const exists = s.races.some((x) => x.id === race.id)
  return { ...s, races: exists ? s.races.map((x) => (x.id === race.id ? race : x)) : [...s.races, race] }
}

export function removeRace(s: UserState, id: string): UserState {
  return { ...s, races: s.races.filter((x) => x.id !== id) }
}

/** Remplace tout ce qui venait de PeakMind par la nouvelle synchro ; les saisies manuelles restent. */
export function applyPeakmindSync(s: UserState, sessions: TrainingSession[], races: StoredRace[], at: string): UserState {
  const profile = s.profile?.sport?.peakmind ? { ...s.profile, sport: { ...s.profile.sport, peakmind: { ...s.profile.sport.peakmind, lastSync: at } } } : s.profile
  return {
    ...s,
    profile,
    training: [...s.training.filter((x) => x.source !== 'peakmind'), ...sessions],
    races: [...s.races.filter((x) => x.source !== 'peakmind'), ...races],
  }
}

// --- Batch cooking -------------------------------------------------------------------------

export function applyBatch(s: UserState, proposal: BatchProposal): UserState {
  if (proposal.entries.length === 0) return s
  return { ...s, plan: [...s.plan, ...proposal.entries], batches: [...s.batches, proposal.session] }
}

/** Annule une session de batch : ses repas disparaissent du planning (et donc des courses). */
export function removeBatch(s: UserState, id: string): UserState {
  return { ...s, plan: s.plan.filter((e) => e.batchId !== id), batches: s.batches.filter((b) => b.id !== id) }
}
