import type { BaseUnit, Ingredient, Unit } from './types'

// Conversion de toute quantite vers l'unite de reference de l'ingredient (g, ml ou piece).
// Regle : si une conversion demande une donnee absente (densite, poids d'une piece...), on renvoie
// null plutot que de deviner -- l'appelant garde alors la quantite a part, signalee comme non
// additionnable, au lieu d'afficher un total faux.

type Family = 'mass' | 'volume' | 'piece'

const MEASURES: Partial<Record<Unit, { family: Family; factor: number }>> = {
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  pincee: { family: 'mass', factor: 0.5 },
  ml: { family: 'volume', factor: 1 },
  cl: { family: 'volume', factor: 10 },
  l: { family: 'volume', factor: 1000 },
  cas: { family: 'volume', factor: 15 },
  cac: { family: 'volume', factor: 5 },
  piece: { family: 'piece', factor: 1 },
}

const FAMILY_OF_BASE: Record<BaseUnit, Family> = { g: 'mass', ml: 'volume', piece: 'piece' }

/** Convertit une quantite saisie vers la baseUnit de l'ingredient. null si impossible sans inventer. */
export function toBase(quantity: number, unit: Unit, ing: Ingredient): number | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null

  // Conditionnements "naturels" (gousse, botte, boite...) : leur taille depend de l'ingredient.
  const natural = ing.unitSizes?.[unit]
  if (natural != null) return quantity * natural
  const measure = MEASURES[unit]
  if (!measure) return null

  const amount = quantity * measure.factor
  const from = measure.family
  const to = FAMILY_OF_BASE[ing.baseUnit]
  if (from === to) return amount

  // Passage par la masse comme pivot.
  let grams: number | null
  if (from === 'mass') grams = amount
  else if (from === 'volume') grams = ing.density != null ? amount * ing.density : null
  else grams = ing.pieceGrams != null ? amount * ing.pieceGrams : null
  if (grams == null) return null

  if (to === 'mass') return grams
  if (to === 'volume') return ing.density != null ? grams / ing.density : null
  return ing.pieceGrams != null ? grams / ing.pieceGrams : null
}

/** Masse en grammes (utile pour la nutrition, toujours exprimee pour 100 g / 100 ml). */
export function baseToGrams(value: number, ing: Ingredient): number | null {
  if (ing.baseUnit === 'g') return value
  if (ing.baseUnit === 'ml') return ing.density != null ? value * ing.density : value // eau par defaut pour les liquides
  return ing.pieceGrams != null ? value * ing.pieceGrams : null
}

/** Arrondi d'affichage : precision relative a l'ordre de grandeur, jamais 437,5 g. */
export function roundForDisplay(value: number): number {
  if (value <= 0) return 0
  if (value < 10) return Math.round(value * 2) / 2
  if (value < 100) return Math.round(value / 5) * 5
  if (value < 1000) return Math.round(value / 10) * 10
  return Math.round(value / 50) * 50
}

/** Arrondi d'une quantite en pieces : au demi pres, mais jamais 0 si on en a besoin. */
export function roundPieces(value: number): number {
  if (value <= 0) return 0
  return Math.max(0.5, Math.round(value * 2) / 2)
}

function fr(n: number, decimals = 1): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimals })
}

/** "450 g", "1,2 kg", "75 cl", "3 oignons"... a partir d'une valeur en baseUnit. */
export function formatBaseQuantity(value: number, ing: Ingredient): string {
  if (ing.baseUnit === 'piece') {
    const n = roundPieces(value)
    const name = n > 1 ? (ing.plural ?? ing.name) : ing.name
    return `${fr(n)} ${name.toLowerCase()}`
  }
  const r = roundForDisplay(value)
  if (ing.baseUnit === 'g') return r >= 1000 ? `${fr(r / 1000, 2)} kg` : `${fr(r)} g`
  return r >= 1000 ? `${fr(r / 1000, 2)} l` : r >= 100 ? `${fr(r / 10)} cl` : `${fr(r)} ml`
}

const UNIT_LABEL: Record<Unit, [string, string]> = {
  g: ['g', 'g'], kg: ['kg', 'kg'], ml: ['ml', 'ml'], cl: ['cl', 'cl'], l: ['l', 'l'],
  cas: ['c. à soupe', 'c. à soupe'], cac: ['c. à café', 'c. à café'], pincee: ['pincée', 'pincées'],
  piece: ['', ''], gousse: ['gousse', 'gousses'], tranche: ['tranche', 'tranches'],
  botte: ['botte', 'bottes'], boite: ['boîte', 'boîtes'], sachet: ['sachet', 'sachets'],
}

/** Affichage d'une ligne de recette telle qu'ecrite : "2 c. à soupe d'huile d'olive". */
export function formatRecipeQuantity(quantity: number | null, unit: Unit, ing: Ingredient): string {
  if (quantity == null) return `${ing.name} (selon le goût)`
  const q = unit === 'piece' ? roundPieces(quantity) : unit === 'g' || unit === 'ml' ? roundForDisplay(quantity) : Math.round(quantity * 4) / 4
  if (unit === 'piece') {
    const name = q > 1 ? (ing.plural ?? ing.name) : ing.name
    return `${fr(q, 2)} ${name.toLowerCase()}`
  }
  const [one, many] = UNIT_LABEL[unit]
  const lower = ing.name.toLowerCase()
  const de = /^[aeiouyhéèêàâîïôœ]/i.test(lower) ? "d'" : 'de '
  return `${fr(q, 2)} ${q > 1 ? many : one} ${de}${lower}`
}

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'g', label: 'g' }, { value: 'kg', label: 'kg' }, { value: 'ml', label: 'ml' },
  { value: 'cl', label: 'cl' }, { value: 'l', label: 'l' }, { value: 'piece', label: 'pièce(s)' },
  { value: 'cas', label: 'c. à soupe' }, { value: 'cac', label: 'c. à café' },
  { value: 'boite', label: 'boîte(s)' }, { value: 'sachet', label: 'sachet(s)' }, { value: 'botte', label: 'botte(s)' },
]

/** Quantite lisible ("500 g", "3 œufs") quelle que soit l'unite saisie, convertie si possible. */
export function formatAmount(quantity: number, unit: Unit, ing: Ingredient): string {
  const base = toBase(quantity, unit, ing)
  if (base != null) return formatBaseQuantity(base, ing)
  return `${quantity.toLocaleString('fr-FR')} ${UNIT_LABEL[unit][quantity > 1 ? 1 : 0]}`.trim()
}
