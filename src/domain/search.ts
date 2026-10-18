import type { CourseType, Diet, MealSlot, Recipe, RecipeTag } from './types'
import { type Catalog, findIngredientsInText, normalizeText } from './catalog'
import type { RecipeAnalysis } from './analysis'
import { suggestRecipes, type ScoreContext, type Scored } from './scoring'
import { pantryCoverage } from './shopping'

// Recherche en langage naturel SANS IA : "j'ai des courgettes et du poulet", "un plat sain en moins
// de 20 minutes", "riche en protéines pour moins de 3 € par personne"... Le texte est traduit en
// filtres explicites (affiches a l'utilisateur sous forme de pastilles modifiables), puis classe par
// le meme scoring que le reste de l'app. L'assistant IA, quand il est disponible, produit exactement
// ces memes filtres : un seul moteur, deux portes d'entree.

export type QueryFilters = {
  text?: string
  ingredients: string[]
  maxMinutes?: number
  maxCostPerServing?: number
  minProtein?: number
  healthy?: boolean
  indulgent?: boolean
  diet?: Diet
  leftovers?: boolean
  slot?: MealSlot
  course?: CourseType
  cuisine?: string
  tags: RecipeTag[]
  maxDifficulty?: number
}

const CUISINES: Record<string, string> = {
  italien: 'italienne', italienne: 'italienne', asiatique: 'asiatique', chinois: 'asiatique', japonais: 'asiatique', thai: 'asiatique',
  indien: 'indienne', indienne: 'indienne', mexicain: 'mexicaine', mexicaine: 'mexicaine', libanais: 'orientale', oriental: 'orientale',
  orientale: 'orientale', marocain: 'orientale', francais: 'française', francaise: 'française', espagnol: 'espagnole', grec: 'méditerranéenne',
}

export function parseQuery(raw: string, catalog: Catalog): QueryFilters {
  const q = normalizeText(raw)
  const f: QueryFilters = { ingredients: [], tags: [] }

  const minutes = q.match(/(?:moins de|en|max(?:imum)?|pas plus de|sous)\s*(\d{1,3})\s*(?:min|minute)/)
  if (minutes) f.maxMinutes = Number(minutes[1])
  else if (/\b(rapide|vite|express|presse|rentre tard|pas le temps|flemme)\b/.test(q)) f.maxMinutes = 25

  const euros = raw.toLowerCase().match(/(?:moins de|max(?:imum)?|pas plus de|sous)?\s*(\d+(?:[.,]\d+)?)\s*(?:€|euros?)/)
  if (euros) f.maxCostPerServing = Number(euros[1].replace(',', '.'))
  else if (/\b(pas cher|economique|petit budget|fin de mois)\b/.test(q)) f.maxCostPerServing = 2.5

  if (/\bprotein|\bproteine/.test(q)) f.minProtein = 25
  if (/\b(sain|leger|legere|equilibre|healthy|light|detox)\b/.test(q)) f.healthy = true
  if (/\b(gourmand|plaisir|reconfort|cocooning|regressif|craquer)\b/.test(q)) f.indulgent = true
  if (/\b(vegan|vegetalien)/.test(q)) f.diet = 'vegetalien'
  else if (/\b(vege|vegetarien|sans viande)/.test(q)) f.diet = 'vegetarien'
  if (/\b(reste|restes|anti gaspi|gaspillage|fond de frigo|vider le frigo)\b/.test(q)) f.leftovers = true

  if (/\b(petit dej|petit dejeuner|brunch|matin)\b/.test(q)) f.slot = 'petit_dejeuner'
  else if (/\b(ce soir|diner|soir)\b/.test(q)) f.slot = 'diner'
  else if (/\b(midi|dejeuner|lunch)\b/.test(q)) f.slot = 'dejeuner'
  else if (/\b(gouter|collation|en cas)\b/.test(q)) f.slot = 'collation'

  if (/\bdessert/.test(q)) f.course = 'dessert'
  else if (/\bsoupe|veloute/.test(q)) f.course = 'soupe'
  else if (/\bsalade/.test(q)) f.course = 'salade'

  for (const [word, cuisine] of Object.entries(CUISINES)) if (new RegExp(`\\b${word}\\b`).test(q)) f.cuisine = cuisine
  if (/\bsans cuisson\b/.test(q)) f.tags.push('sans_cuisson')
  if (/\b(batch|a l avance|meal prep)\b/.test(q)) f.tags.push('batch')
  if (/\b(facile|debutant|simple)\b/.test(q)) f.maxDifficulty = 1

  f.ingredients = findIngredientsInText(catalog, raw).map((i) => i.id)

  // Texte libre residuel : recherche par nom de recette si rien d'autre n'a ete reconnu.
  const recognized = f.ingredients.length > 0 || Object.keys(f).some((k) => !['ingredients', 'tags', 'text'].includes(k) && f[k as keyof QueryFilters] != null) || f.tags.length > 0
  if (!recognized && q.length > 0) f.text = q
  return f
}

export function matchesFilters(r: Recipe, a: RecipeAnalysis, f: QueryFilters): boolean {
  if (f.maxMinutes != null && a.totalMinutes > f.maxMinutes) return false
  if (f.maxCostPerServing != null && a.costPerServing.value > f.maxCostPerServing) return false
  if (f.minProtein != null && a.nutrition.value.protein < f.minProtein) return false
  if (f.healthy && !(a.vegetableGrams >= 100 || r.tags.includes('leger'))) return false
  if (f.indulgent && !(r.tags.includes('gourmand') || r.tags.includes('reconfortant'))) return false
  if (f.diet && !a.diets.includes(f.diet)) return false
  if (f.slot && !r.slots.includes(f.slot)) return false
  if (f.course && r.course !== f.course) return false
  if (f.cuisine && r.cuisine !== f.cuisine) return false
  if (f.tags.some((t) => !r.tags.includes(t))) return false
  if (f.maxDifficulty != null && r.difficulty > f.maxDifficulty) return false
  // Plusieurs ingredients peuvent porter le meme nom courant ("poulet" : blanc, cuisse) : un seul suffit.
  if (f.ingredients.length > 0 && !f.ingredients.some((id) => r.ingredients.some((l) => l.ingredientId === id))) return false
  if (f.text) {
    const name = normalizeText(`${r.name} ${r.description}`)
    if (!f.text.split(' ').filter((w) => w.length > 2).every((w) => name.includes(w))) return false
  }
  return true
}

export function filterChips(f: QueryFilters, catalog: Catalog): string[] {
  const chips: string[] = []
  if (f.ingredients.length) chips.push(`Avec : ${f.ingredients.map((i) => catalog.ingredients.get(i)?.name.toLowerCase()).join(', ')}`)
  if (f.maxMinutes) chips.push(`≤ ${f.maxMinutes} min`)
  if (f.maxCostPerServing) chips.push(`≤ ${f.maxCostPerServing.toLocaleString('fr-FR')} €/pers.`)
  if (f.minProtein) chips.push('Riche en protéines')
  if (f.healthy) chips.push('Équilibré')
  if (f.indulgent) chips.push('Gourmand')
  if (f.diet) chips.push(f.diet === 'vegetalien' ? 'Végétalien' : 'Végétarien')
  if (f.leftovers) chips.push('Avec mon stock')
  if (f.course) chips.push(f.course === 'dessert' ? 'Dessert' : f.course === 'soupe' ? 'Soupe' : 'Salade')
  if (f.cuisine) chips.push(`Cuisine ${f.cuisine}`)
  if (f.maxDifficulty) chips.push('Facile')
  if (f.text) chips.push(`« ${f.text} »`)
  return chips
}

export function searchRecipes(query: string | QueryFilters, ctx: ScoreContext, limit = 30): { filters: QueryFilters; results: Scored[] } {
  const filters = typeof query === 'string' ? parseQuery(query, ctx.catalog) : query
  const results = suggestRecipes(ctx, {
    limit: 200,
    slot: undefined,
    filter: (r, a) => matchesFilters(r, a, filters),
  })
  // Bonus : nombre d'ingredients demandes reellement utilises.
  for (const s of results) {
    const hits = filters.ingredients.filter((id) => s.recipe.ingredients.some((l) => l.ingredientId === id)).length
    s.score += hits * 1.2
  }
  // "Avec mes restes" : uniquement des recettes qui puisent vraiment dans le stock (ou anti-gaspi par nature).
  const pantry = ctx.pantry ?? []
  const kept = filters.leftovers && pantry.length > 0
    ? results.filter((s) => s.recipe.tags.includes('anti_gaspi') || pantryCoverage(s.recipe, pantry, ctx.catalog, ctx.today).ratio >= 0.3)
    : results
  return { filters, results: kept.sort((a, b) => b.score - a.score).slice(0, limit) }
}
