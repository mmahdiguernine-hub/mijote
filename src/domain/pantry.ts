import type { PantryItem, Recipe, Unit } from './types'
import { type Catalog, ingredientOf } from './catalog'
import { toBase } from './units'
import { addDays, type ShoppingLine } from './shopping'
import { daysBetween } from './planner'

// Frigo et placards. Le stock est volontairement tolerant : quantite inconnue ("j'en ai"), date de
// peremption facultative, source prevue pour le scan (code-barres/photo) sans rien changer ailleurs.

export type ExpiryStatus = 'perime' | 'aujourdhui' | 'bientot' | 'ok' | 'inconnu'

export function expiryStatus(item: PantryItem, today: string): ExpiryStatus {
  if (!item.expiresOn) return 'inconnu'
  const d = daysBetween(today, item.expiresOn)
  if (d < 0) return 'perime'
  if (d === 0) return 'aujourdhui'
  if (d <= 3) return 'bientot'
  return 'ok'
}

/** Produits a utiliser en priorite (perimes exclus), du plus urgent au moins urgent. */
export function expiringSoon(pantry: PantryItem[], today: string, withinDays = 3): PantryItem[] {
  const limit = addDays(today, withinDays)
  return pantry
    .filter((p) => p.expiresOn && p.expiresOn >= today && p.expiresOn <= limit)
    .sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!))
}

/**
 * "J'ai cuisine ce repas" : retire du stock les quantites utilisees, en commencant par les produits
 * qui perissent le plus tot. Un article dont la quantite est inconnue est conserve tel quel (on ne
 * sait pas s'il en reste).
 */
export function consumeRecipe(pantry: PantryItem[], recipe: Recipe, servings: number, catalog: Catalog): PantryItem[] {
  const factor = servings / recipe.servings
  let out = pantry.map((p) => ({ ...p }))
  for (const line of recipe.ingredients) {
    if (line.quantity == null || line.optional) continue
    const ing = ingredientOf(catalog, line.ingredientId)
    if (ing.staple) continue
    let remaining = toBase(line.quantity * factor, line.unit, ing)
    if (remaining == null) continue
    const items = out
      .filter((p) => p.ingredientId === ing.id && p.quantity != null)
      .sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'))
    for (const item of items) {
      if (remaining <= 0) break
      const have = toBase(item.quantity!, item.unit, ing)
      if (have == null) continue
      const used = Math.min(have, remaining)
      remaining -= used
      const left = have - used
      // Ramene dans l'unite de reference pour eviter les conversions inverses approximatives.
      item.quantity = Math.round(left * 100) / 100
      item.unit = ing.baseUnit as Unit
    }
    out = out.filter((p) => p.quantity == null || p.quantity > 0.01)
  }
  return out
}

/** Ajoute au stock les articles coches de la liste ("courses faites"). */
export function addPurchases(
  pantry: PantryItem[],
  lines: ShoppingLine[],
  catalog: Catalog,
  today: string,
  makeId: () => string,
): PantryItem[] {
  const out = [...pantry]
  for (const l of lines) {
    if (!l.ingredientId || !l.checked) continue
    const ing = ingredientOf(catalog, l.ingredientId)
    const amount = l.purchase?.total ?? l.toBuy
    if (amount <= 0) continue
    out.push({
      id: makeId(),
      ingredientId: ing.id,
      quantity: Math.round(amount * 100) / 100,
      unit: ing.baseUnit as Unit,
      expiresOn: ing.shelfLifeDays != null && ing.shelfLifeDays <= 30 ? addDays(today, ing.shelfLifeDays) : undefined,
      expiryEstimated: ing.shelfLifeDays != null && ing.shelfLifeDays <= 30 ? true : undefined,
      addedOn: today,
      source: 'courses',
    })
  }
  return out
}
