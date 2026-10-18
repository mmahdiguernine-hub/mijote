import type { Ingredient, Recipe } from './types'

/** Acces en lecture au referentiel. Construit une fois (statique aujourd'hui, base de donnees demain). */
export type Catalog = {
  ingredients: Map<string, Ingredient>
  recipes: Recipe[]
  recipesById: Map<string, Recipe>
}

export function buildCatalog(ingredients: Ingredient[], recipes: Recipe[]): Catalog {
  return {
    ingredients: new Map(ingredients.map((i) => [i.id, i])),
    recipes,
    recipesById: new Map(recipes.map((r) => [r.id, r])),
  }
}

export function withRecipes(catalog: Catalog, extra: Recipe[]): Catalog {
  if (extra.length === 0) return catalog
  const recipes = [...catalog.recipes.filter((r) => !extra.some((e) => e.id === r.id)), ...extra]
  return { ...catalog, recipes, recipesById: new Map(recipes.map((r) => [r.id, r])) }
}

/** Leve une erreur explicite plutot que de produire silencieusement un calcul faux. */
export function ingredientOf(catalog: Catalog, id: string): Ingredient {
  const ing = catalog.ingredients.get(id)
  if (!ing) throw new Error(`Ingredient inconnu dans le referentiel : ${id}`)
  return ing
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export { normalize as normalizeText }

/**
 * Rapproche un texte libre ("courgettes", "blanc de poulet") d'un ingredient du referentiel.
 * Prefere la correspondance la plus longue pour que "creme fraiche" batte "creme".
 */
export function matchIngredient(catalog: Catalog, text: string): Ingredient | null {
  const t = ` ${normalize(text)} `
  let best: { ing: Ingredient; len: number } | null = null
  for (const ing of catalog.ingredients.values()) {
    for (const name of namesOf(ing)) {
      const n = normalize(name)
      if (n.length < 3) continue
      // singulier/pluriel simple : "courgette" trouve aussi "courgettes"
      if (t.includes(` ${n} `) || t.includes(` ${n}s `) || t.includes(` ${n}x `)) {
        if (!best || n.length > best.len) best = { ing, len: n.length }
      }
    }
  }
  return best?.ing ?? null
}

/** Tous les ingredients cites dans un texte (pour "j'ai des courgettes et du poulet"). */
export function findIngredientsInText(catalog: Catalog, text: string): Ingredient[] {
  const t = ` ${normalize(text)} `
  const found: { ing: Ingredient; n: string }[] = []
  for (const ing of catalog.ingredients.values()) {
    for (const name of namesOf(ing)) {
      const n = normalize(name)
      if (n.length < 3) continue
      if (t.includes(` ${n} `) || t.includes(` ${n}s `) || t.includes(` ${n}x `)) {
        found.push({ ing, n })
        break
      }
    }
  }
  // Retire les correspondances englobees ("creme" quand "creme fraiche" est trouve).
  return found
    .filter((f) => !found.some((o) => o !== f && o.n.length > f.n.length && o.n.includes(f.n)))
    .map((f) => f.ing)
}

function namesOf(ing: Ingredient): string[] {
  return [ing.name, ing.plural, ...(ing.aliases ?? [])].filter((n): n is string => !!n)
}
