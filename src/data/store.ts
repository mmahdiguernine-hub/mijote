import type { SupabaseClient } from '@supabase/supabase-js'
import type { ManualShoppingItem, PantryItem, PlanEntry, Recipe, ShoppingListMeta, ShoppingOverride } from '@/domain/types'
import { EMPTY_STATE, normalizeProfile, type UserState } from './state'

// Persistance derriere une interface unique :
// - LocalStore : tout reste dans le navigateur (mode sans compte, et cache hors ligne) ;
// - SupabaseStore : base Postgres protegee par RLS, synchronisee entre appareils.
// L'app ne fait que produire un nouvel etat ; `persist` calcule le diff et n'ecrit que ce qui a
// change (quelques lignes par action, jamais l'etat entier).

export interface UserStore {
  readonly mode: 'local' | 'cloud'
  load(): Promise<UserState>
  persist(prev: UserState, next: UserState): Promise<void>
}

const CACHE_PREFIX = 'mijote:state:v1'

function readCache(key: string): UserState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UserState>
    return { ...EMPTY_STATE, ...parsed, profile: normalizeProfile(parsed.profile) }
  } catch {
    return null
  }
}

function writeCache(key: string, state: UserState) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // stockage plein ou bloque (navigation privee) : l'app continue de fonctionner en memoire
  }
}

export class LocalStore implements UserStore {
  readonly mode = 'local' as const
  constructor(private key = `${CACHE_PREFIX}:local`) {}
  async load() {
    return readCache(this.key) ?? EMPTY_STATE
  }
  async persist(_prev: UserState, next: UserState) {
    writeCache(this.key, next)
  }
}

// --- Supabase -----------------------------------------------------------------------------

type Row = Record<string, unknown>

function diffById<T extends { id: string }>(prev: T[], next: T[]): { upserts: T[]; deletes: string[] } {
  const before = new Map(prev.map((x) => [x.id, x]))
  const after = new Set(next.map((x) => x.id))
  const upserts = next.filter((x) => {
    const old = before.get(x.id)
    return !old || JSON.stringify(old) !== JSON.stringify(x)
  })
  const deletes = prev.filter((x) => !after.has(x.id)).map((x) => x.id)
  return { upserts, deletes }
}

const planToRow = (e: PlanEntry): Row => ({
  id: e.id, date: e.date, slot: e.slot, kind: e.kind, recipe_id: e.recipeId ?? null, variant: e.variant ?? null, servings: e.servings,
  leftover_servings: e.leftoverServings ?? null, leftover_of: e.leftoverOf ?? null, locked: !!e.locked, cooked_at: e.cookedAt ?? null, note: e.note ?? null,
  cook_on: e.cookOn ?? null, batch_id: e.batchId ?? null,
})
const rowToPlan = (r: Row): PlanEntry => ({
  id: r.id as string, date: r.date as string, slot: r.slot as PlanEntry['slot'], kind: r.kind as PlanEntry['kind'],
  recipeId: (r.recipe_id as string) ?? undefined, variant: (r.variant as PlanEntry['variant']) ?? undefined, servings: r.servings as number,
  leftoverServings: (r.leftover_servings as number) ?? undefined, leftoverOf: (r.leftover_of as string) ?? undefined,
  locked: (r.locked as boolean) || undefined, cookedAt: (r.cooked_at as string) ?? undefined, note: (r.note as string) ?? undefined,
  cookOn: (r.cook_on as string) ?? undefined, batchId: (r.batch_id as string) ?? undefined,
})

const pantryToRow = (p: PantryItem): Row => ({
  id: p.id, ingredient_id: p.ingredientId, quantity: p.quantity, unit: p.unit, expires_on: p.expiresOn ?? null,
  expiry_estimated: !!p.expiryEstimated, added_on: p.addedOn, source: p.source, barcode: p.barcode ?? null,
})
const rowToPantry = (r: Row): PantryItem => ({
  id: r.id as string, ingredientId: r.ingredient_id as string, quantity: r.quantity == null ? null : Number(r.quantity), unit: r.unit as PantryItem['unit'],
  expiresOn: (r.expires_on as string) ?? undefined, expiryEstimated: (r.expiry_estimated as boolean) || undefined, addedOn: r.added_on as string,
  source: r.source as PantryItem['source'], barcode: (r.barcode as string) ?? undefined,
})

const listToRow = (l: ShoppingListMeta): Row => ({
  id: l.id, name: l.name, mode: l.mode, date_from: l.from ?? null, date_to: l.to ?? null, recipe_id: l.recipeId ?? null, servings: l.servings ?? null, created_at: l.createdAt,
})
const rowToList = (r: Row): ShoppingListMeta => ({
  id: r.id as string, name: r.name as string, mode: r.mode as ShoppingListMeta['mode'], from: (r.date_from as string) ?? undefined, to: (r.date_to as string) ?? undefined,
  recipeId: (r.recipe_id as string) ?? undefined, servings: (r.servings as number) ?? undefined, createdAt: r.created_at as string,
})

const manualToRow = (m: ManualShoppingItem): Row => ({
  id: m.id, list_id: m.listId ?? null, ingredient_id: m.ingredientId ?? null, label: m.label, quantity: m.quantity, unit: m.unit, aisle: m.aisle,
  recurring: m.recurring, checked: m.checked, store: m.store ?? null,
})
const rowToManual = (r: Row): ManualShoppingItem => ({
  id: r.id as string, listId: (r.list_id as string) ?? null, ingredientId: (r.ingredient_id as string) ?? undefined, label: r.label as string,
  quantity: r.quantity == null ? null : Number(r.quantity), unit: r.unit as ManualShoppingItem['unit'], aisle: r.aisle as ManualShoppingItem['aisle'],
  recurring: r.recurring as boolean, checked: r.checked as boolean, store: (r.store as string) ?? undefined,
})

type OverrideRow = { id: string; list_id: string; line_key: string; checked: boolean | null; removed: boolean | null; quantity_override: number | null; store: string | null }
function flattenOverrides(o: Record<string, ShoppingOverride[]>): OverrideRow[] {
  return Object.entries(o).flatMap(([listId, list]) =>
    list.map((x) => ({ id: `${listId}|${x.key}`, list_id: listId, line_key: x.key, checked: x.checked ?? null, removed: x.removed ?? null, quantity_override: x.quantityOverride ?? null, store: x.store ?? null })),
  )
}

export class SupabaseStore implements UserStore {
  readonly mode = 'cloud' as const
  private cacheKey: string
  constructor(private db: SupabaseClient, private userId: string) {
    this.cacheKey = `${CACHE_PREFIX}:${userId}`
  }

  async load(): Promise<UserState> {
    const q = <T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) =>
      Promise.resolve(p).then((r) => {
        if (r.error) throw new Error(r.error.message)
        return r.data
      })
    try {
      const [profile, plan, pantry, lists, manual, overrides, recipes, docs] = await Promise.all([
        q(this.db.from('profiles').select('data').eq('id', this.userId).maybeSingle()),
        q(this.db.from('plan_entries').select('*')),
        q(this.db.from('pantry_items').select('*')),
        q(this.db.from('shopping_lists').select('*')),
        q(this.db.from('shopping_manual_items').select('*')),
        q(this.db.from('shopping_overrides').select('*')),
        q(this.db.from('user_recipes').select('data')),
        q(this.db.from('user_documents').select('kind, data')),
      ])
      const docsOf = <T,>(kind: string) => ((docs as { kind: string; data: T }[]) ?? []).filter((d) => d.kind === kind).map((d) => d.data)
      const byList: Record<string, ShoppingOverride[]> = {}
      for (const r of (overrides as Row[]) ?? []) {
        const list = (byList[r.list_id as string] ??= [])
        list.push({ key: r.line_key as string, checked: (r.checked as boolean) ?? undefined, removed: (r.removed as boolean) ?? undefined, quantityOverride: r.quantity_override == null ? undefined : Number(r.quantity_override), store: (r.store as string) ?? undefined })
      }
      const state: UserState = {
        profile: normalizeProfile((profile as { data: UserState['profile'] } | null)?.data),
        plan: ((plan as Row[]) ?? []).map(rowToPlan),
        pantry: ((pantry as Row[]) ?? []).map(rowToPantry),
        lists: ((lists as Row[]) ?? []).map(rowToList),
        manual: ((manual as Row[]) ?? []).map(rowToManual),
        overrides: byList,
        userRecipes: ((recipes as { data: Recipe }[]) ?? []).map((r) => r.data),
        training: docsOf('seance'),
        races: docsOf('course'),
        batches: docsOf('batch'),
      }
      writeCache(this.cacheKey, state)
      return state
    } catch (e) {
      // Hors ligne : on repart du dernier etat connu sur cet appareil, et on le dit.
      const cached = readCache(this.cacheKey)
      if (cached) return cached
      throw e
    }
  }

  async persist(prev: UserState, next: UserState): Promise<void> {
    writeCache(this.cacheKey, next)
    const ops: PromiseLike<{ error: { message: string } | null }>[] = []
    const sync = <T extends { id: string }>(table: string, a: T[], b: T[], toRow: (x: T) => Row) => {
      const { upserts, deletes } = diffById(a, b)
      if (upserts.length) ops.push(this.db.from(table).upsert(upserts.map((x) => ({ ...toRow(x), user_id: this.userId }))))
      if (deletes.length) ops.push(this.db.from(table).delete().in('id', deletes))
    }
    if (JSON.stringify(prev.profile) !== JSON.stringify(next.profile) && next.profile) {
      ops.push(this.db.from('profiles').upsert({ id: this.userId, data: next.profile, updated_at: new Date().toISOString() }))
    }
    sync('plan_entries', prev.plan, next.plan, planToRow)
    sync('pantry_items', prev.pantry, next.pantry, pantryToRow)
    sync('shopping_lists', prev.lists, next.lists, listToRow)
    sync('shopping_manual_items', prev.manual, next.manual, manualToRow)
    sync('user_recipes', prev.userRecipes, next.userRecipes, (r) => ({ id: r.id, data: r, source_url: r.source.url ?? null }))
    // Seances, courses et sessions de batch : petits documents JSON dans une table generique.
    sync('user_documents', prev.training, next.training, (x) => ({ id: x.id, kind: 'seance', data: x }))
    sync('user_documents', prev.races, next.races, (x) => ({ id: x.id, kind: 'course', data: x }))
    sync('user_documents', prev.batches, next.batches, (x) => ({ id: x.id, kind: 'batch', data: x }))

    const { upserts, deletes } = diffById(flattenOverrides(prev.overrides), flattenOverrides(next.overrides))
    if (upserts.length) ops.push(this.db.from('shopping_overrides').upsert(upserts.map(({ id: _id, ...row }) => { void _id; return { ...row, user_id: this.userId } })))
    for (const id of deletes) {
      const [listId, key] = id.split('|')
      ops.push(this.db.from('shopping_overrides').delete().eq('list_id', listId).eq('line_key', key))
    }

    const results = await Promise.all(ops)
    const failed = results.find((r) => r.error)
    if (failed?.error) throw new Error(failed.error.message)
  }
}

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}
