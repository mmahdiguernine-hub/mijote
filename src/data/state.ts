import type { ManualShoppingItem, PantryItem, PlanEntry, Profile, Recipe, ShoppingListMeta, ShoppingOverride } from '@/domain/types'

// Etat utilisateur complet. Petit par nature (un foyer, quelques semaines de planning) : il est
// charge en entier au demarrage puis modifie par des fonctions pures. La persistance (locale ou
// Supabase) est un detail branche derriere `UserStore` (store.ts).

export type UserState = {
  profile: Profile | null
  plan: PlanEntry[]
  pantry: PantryItem[]
  lists: ShoppingListMeta[]
  manual: ManualShoppingItem[]
  /** listId -> overrides */
  overrides: Record<string, ShoppingOverride[]>
  userRecipes: Recipe[]
}

export const EMPTY_STATE: UserState = { profile: null, plan: [], pantry: [], lists: [], manual: [], overrides: {}, userRecipes: [] }

export const DEFAULT_PROFILE: Profile = {
  diet: 'omnivore',
  allergens: [],
  excludedIngredients: [],
  dislikedIngredients: [],
  likedIngredients: [],
  goals: [],
  householdSize: 2,
  maxMinutesWeekday: 40,
  maxMinutesWeekend: 90,
  skill: 2,
  equipment: ['plaque', 'four', 'micro_ondes', 'mixeur'],
  discovery: 0.5,
  preferSeasonal: true,
  cookingStyle: 'mixte',
  leftoversOk: true,
  slots: ['dejeuner', 'diner'],
  onboardingDone: false,
}

/** Normalise un profil charge (champs ajoutes dans une version ulterieure de l'app). */
export function normalizeProfile(p: Partial<Profile> | null | undefined): Profile | null {
  if (!p) return null
  return { ...DEFAULT_PROFILE, ...p }
}

let seq = 0
export function newId(prefix = ''): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${rand}`
}

/** Date locale AAAA-MM-JJ (pas toISOString, qui decale d'un jour le soir en UTC+). */
export function localISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function weekListId(monday: string): string {
  return `semaine-${monday}`
}
