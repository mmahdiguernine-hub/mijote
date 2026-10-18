import type {
  Allergen, Confidence, Diet, PantryItem, Profile, Recipe, RecipeIngredient, VariantChange, VariantKind, IngredientTag,
} from './types'
import { type Catalog, ingredientOf } from './catalog'
import { checkRecipe } from './constraints'

// Moteur de personnalisation : transforme une recette en une VERSION (vegetarienne, economique,
// rapide...) par des regles explicites -- jamais en "inventant" une recette. Chaque changement est
// trace (quoi, pourquoi, avec quelle confiance) et la nutrition/le cout sont recalcules ensuite par
// analysis.ts sur la recette produite, donc toujours coherents avec les ingredients reels.
// Quand aucune regle ne s'applique, la variante le dit (warnings) au lieu de renvoyer une copie
// trompeuse de l'original.

export type SubstitutionRule = {
  from: string
  to: string
  /** Quantite de `to` pour 1 de `from`, dans les unites de la ligne d'origine. */
  ratio: number
  kinds: VariantKind[]
  confidence: Confidence
  note: string
  /** Minutes gagnees (variante rapide). */
  minutesSaved?: number
}

const VEG: VariantKind[] = ['vegetarienne', 'vegetalienne']
const VEGAN: VariantKind[] = ['vegetalienne']

export const SUBSTITUTIONS: SubstitutionRule[] = [
  // Viandes et poissons -> proteines vegetales
  { from: 'blanc_poulet', to: 'tofu_ferme', ratio: 1, kinds: VEG, confidence: 'moyenne', note: 'Faire dorer le tofu en cubes avant de l’ajouter : il prend bien les sauces.' },
  { from: 'cuisse_poulet', to: 'tofu_ferme', ratio: 0.7, kinds: VEG, confidence: 'moyenne', note: 'Quantité réduite (pas d’os). Faire dorer le tofu à part.' },
  { from: 'boeuf_hache', to: 'lentilles_vertes', ratio: 0.45, kinds: [...VEG, 'economique'], confidence: 'moyenne', note: 'Lentilles sèches à cuire 20 min avant de les incorporer : texture proche dans une sauce, moins dans un burger.' },
  { from: 'boeuf_braiser', to: 'champignon', ratio: 1.2, kinds: VEG, confidence: 'faible', note: 'Champignons et lentilles remplacent bien le côté mijoté, mais le goût change nettement.' },
  { from: 'lardons', to: 'tofu_fume', ratio: 1, kinds: VEG, confidence: 'moyenne', note: 'Tofu fumé en petits dés, bien doré : garde le côté fumé.' },
  { from: 'jambon_blanc', to: 'tofu_fume', ratio: 1, kinds: VEG, confidence: 'faible', note: 'Le goût n’est pas le même ; à réserver aux plats où le jambon est secondaire.' },
  { from: 'chorizo', to: 'tofu_fume', ratio: 1, kinds: VEG, confidence: 'faible', note: 'Ajouter 1 c. à café de paprika fumé pour retrouver le goût du chorizo.' },
  { from: 'saucisse', to: 'tofu_fume', ratio: 0.8, kinds: VEG, confidence: 'faible', note: 'Texture différente ; des saucisses végétales du commerce sont plus proches.' },
  { from: 'saumon', to: 'tofu_ferme', ratio: 1, kinds: VEG, confidence: 'faible', note: 'Mariner le tofu (sauce soja, citron) : goût et texture restent différents.' },
  { from: 'cabillaud', to: 'tofu_ferme', ratio: 1, kinds: VEG, confidence: 'faible', note: 'Tofu ferme en tranches, poêlé : alternative pratique mais pas équivalente.' },
  { from: 'crevettes', to: 'pois_chiches', ratio: 1, kinds: VEG, confidence: 'faible', note: 'Pois chiches rôtis : apport en protéines comparable, goût très différent.' },
  { from: 'thon_boite', to: 'pois_chiches', ratio: 1, kinds: VEG, confidence: 'moyenne', note: 'Pois chiches écrasés à la fourchette : très bon en salade ou sandwich.' },
  { from: 'sardines_boite', to: 'pois_chiches', ratio: 1, kinds: VEG, confidence: 'faible', note: 'Alternative végétale, sans les oméga-3 du poisson.' },
  { from: 'bouillon_volaille', to: 'bouillon_legumes', ratio: 1, kinds: VEG, confidence: 'haute', note: 'Bouillon de légumes : goût un peu plus léger.' },
  { from: 'bouillon_boeuf', to: 'bouillon_legumes', ratio: 1, kinds: VEG, confidence: 'haute', note: 'Bouillon de légumes : goût un peu plus léger.' },
  // Produits animaux -> vegetal
  { from: 'beurre', to: 'huile_olive', ratio: 0.8, kinds: [...VEGAN, 'sans_allergenes'], confidence: 'moyenne', note: 'Parfait pour cuire ; en pâtisserie le résultat change.' },
  { from: 'creme_fraiche', to: 'creme_soja', ratio: 1, kinds: [...VEGAN, 'sans_allergenes'], confidence: 'haute', note: 'Crème de soja : ne pas faire bouillir longtemps.' },
  { from: 'creme_liquide', to: 'creme_soja', ratio: 1, kinds: [...VEGAN, 'sans_allergenes'], confidence: 'haute', note: 'Crème de soja : même usage que la crème liquide.' },
  { from: 'lait', to: 'boisson_soja', ratio: 1, kinds: [...VEGAN, 'sans_allergenes'], confidence: 'haute', note: 'Boisson soja nature, non sucrée.' },
  { from: 'yaourt_nature', to: 'yaourt_soja', ratio: 1, kinds: [...VEGAN, 'sans_allergenes'], confidence: 'haute', note: 'Yaourt au soja nature.' },
  { from: 'emmental_rape', to: 'levure_maltee', ratio: 0.3, kinds: VEGAN, confidence: 'faible', note: 'Levure maltée : goût fromager, mais ne gratine pas.' },
  { from: 'parmesan', to: 'levure_maltee', ratio: 0.5, kinds: VEGAN, confidence: 'moyenne', note: 'Levure maltée : bon goût umami, sans fondant.' },
  { from: 'feta', to: 'tofu_ferme', ratio: 1, kinds: VEGAN, confidence: 'faible', note: 'Tofu émietté avec citron, sel et origan ; loin du goût de la feta.' },
  { from: 'miel', to: 'sirop_erable', ratio: 1, kinds: VEGAN, confidence: 'haute', note: 'Sirop d’érable : même pouvoir sucrant.' },
  // Economique
  { from: 'blanc_poulet', to: 'cuisse_poulet', ratio: 1.4, kinds: ['economique'], confidence: 'moyenne', note: 'Cuisses désossées après cuisson ; quantité augmentée pour compenser les os.' },
  { from: 'cabillaud', to: 'colin_surgele', ratio: 1, kinds: ['economique'], confidence: 'haute', note: 'Colin surgelé : décongeler la veille au frigo.' },
  { from: 'saumon', to: 'colin_surgele', ratio: 1, kinds: ['economique'], confidence: 'moyenne', note: 'Poisson blanc moins cher ; moins riche en goût et en oméga-3.' },
  { from: 'pignons', to: 'graines_tournesol', ratio: 1, kinds: ['economique', 'sans_allergenes'], confidence: 'haute', note: 'Graines de tournesol torréfiées à sec.' },
  { from: 'parmesan', to: 'emmental_rape', ratio: 1, kinds: ['economique'], confidence: 'moyenne', note: 'Emmental râpé : goût plus doux.' },
  { from: 'tomate', to: 'tomates_concassees', ratio: 1, kinds: ['economique', 'rapide'], confidence: 'moyenne', note: 'Uniquement pour les plats cuits (sauces, mijotés), pas en salade.' },
  { from: 'basilic', to: 'herbes_provence', ratio: 0.1, kinds: ['economique'], confidence: 'moyenne', note: 'Herbes séchées : moins de fraîcheur.' },
  { from: 'coriandre', to: 'persil', ratio: 1, kinds: ['economique', 'avec_mon_stock'], confidence: 'moyenne', note: 'Goût différent, même fraîcheur.' },
  { from: 'mozzarella', to: 'emmental_rape', ratio: 0.8, kinds: ['economique'], confidence: 'moyenne', note: 'Gratine bien, goût plus prononcé.' },
  // Rapide
  { from: 'lentilles_vertes', to: 'lentilles_boite', ratio: 2.4, kinds: ['rapide'], confidence: 'haute', note: 'Lentilles déjà cuites : rincer et ajouter en fin de cuisson.', minutesSaved: 20 },
  { from: 'haricots_verts', to: 'haricots_verts_surgeles', ratio: 1, kinds: ['rapide', 'economique'], confidence: 'haute', note: 'Pas d’équeutage, cuisson directe.', minutesSaved: 8 },
  { from: 'epinards', to: 'epinards_surgeles', ratio: 1, kinds: ['rapide', 'economique'], confidence: 'haute', note: 'Épinards surgelés en galets : bien égoutter.', minutesSaved: 5 },
  { from: 'riz', to: 'semoule', ratio: 1, kinds: ['rapide'], confidence: 'moyenne', note: 'Semoule prête en 5 minutes hors du feu.', minutesSaved: 10 },
  { from: 'pomme_de_terre', to: 'semoule', ratio: 0.3, kinds: ['rapide'], confidence: 'faible', note: 'Change le plat : à réserver aux accompagnements.', minutesSaved: 15 },
  { from: 'potiron', to: 'carotte', ratio: 1, kinds: ['rapide'], confidence: 'faible', note: 'Carottes en rondelles fines : cuisent plus vite, goût différent.', minutesSaved: 10 },
  // Proteinee / equilibree
  { from: 'pates', to: 'pates_lentilles', ratio: 1, kinds: ['proteinee', 'sans_allergenes'], confidence: 'moyenne', note: 'Pâtes de lentilles corail : deux fois plus de protéines, cuisson plus courte, sans gluten.' },
  { from: 'pates', to: 'pates_completes', ratio: 1, kinds: ['equilibree'], confidence: 'haute', note: 'Pâtes complètes : plus de fibres, goût légèrement plus marqué.' },
  { from: 'riz', to: 'quinoa', ratio: 1, kinds: ['proteinee'], confidence: 'moyenne', note: 'Quinoa : plus de protéines et de fibres.' },
  { from: 'creme_fraiche', to: 'fromage_blanc', ratio: 1, kinds: ['equilibree', 'proteinee'], confidence: 'moyenne', note: 'Ajouter hors du feu pour éviter qu’il ne tranche.' },
  { from: 'creme_liquide', to: 'lait', ratio: 1, kinds: ['equilibree'], confidence: 'faible', note: 'Sauce plus légère et moins nappante ; épaissir avec 1 c. à café de maïzena si besoin.' },
  { from: 'pain', to: 'pain_complet', ratio: 1, kinds: ['equilibree'], confidence: 'haute', note: 'Pain complet : plus de fibres.' },
  // Sans allergenes
  { from: 'pates', to: 'pates_sans_gluten', ratio: 1, kinds: ['sans_allergenes'], confidence: 'haute', note: 'Surveiller la cuisson : elles collent plus vite.' },
  { from: 'farine', to: 'farine_riz', ratio: 1, kinds: ['sans_allergenes'], confidence: 'faible', note: 'Correct pour lier une sauce ; en pâtisserie le résultat est différent.' },
  { from: 'sauce_soja', to: 'tamari', ratio: 1, kinds: ['sans_allergenes'], confidence: 'haute', note: 'Tamari : sauce soja sans gluten (vérifier l’étiquette).' },
  { from: 'pain', to: 'pain_sans_gluten', ratio: 1, kinds: ['sans_allergenes'], confidence: 'haute', note: 'Pain sans gluten.' },
  { from: 'chapelure', to: 'flocons_avoine', ratio: 1, kinds: ['sans_allergenes'], confidence: 'faible', note: 'Flocons mixés : croustillant différent (avoine certifiée sans gluten si besoin).' },
  { from: 'boisson_soja', to: 'boisson_avoine', ratio: 1, kinds: ['sans_allergenes'], confidence: 'haute', note: 'Boisson avoine.' },
  { from: 'creme_soja', to: 'lait_coco', ratio: 1, kinds: ['sans_allergenes'], confidence: 'moyenne', note: 'Lait de coco : apporte un goût coco.' },
  { from: 'tofu_ferme', to: 'pois_chiches', ratio: 1, kinds: ['sans_allergenes'], confidence: 'faible', note: 'Sans soja : pois chiches rôtis.' },
  { from: 'beurre_cacahuete', to: 'puree_amande', ratio: 1, kinds: ['sans_allergenes'], confidence: 'moyenne', note: 'Purée d’amande (fruits à coque).' },
  { from: 'moutarde', to: 'vinaigre_vin', ratio: 0.5, kinds: ['sans_allergenes'], confidence: 'faible', note: 'Apporte l’acidité, pas le piquant.' },
]

/** Familles d'ingredients interchangeables, pour "avec mon stock" : confiance moyenne par nature. */
export const INTERCHANGEABLE: string[][] = [
  ['courgette', 'aubergine', 'poivron'],
  ['epinards', 'epinards_surgeles'],
  ['creme_liquide', 'creme_fraiche'],
  ['emmental_rape', 'parmesan', 'comte'],
  ['riz', 'quinoa', 'boulgour', 'semoule'],
  ['pates', 'pates_completes'],
  ['oignon', 'echalote', 'oignon_rouge'],
  ['persil', 'coriandre', 'ciboulette'],
  ['citron', 'citron_vert'],
  ['haricots_rouges', 'pois_chiches', 'haricots_blancs'],
  ['lentilles_vertes', 'lentilles_corail'],
  ['cabillaud', 'colin_surgele'],
  ['huile_olive', 'huile_tournesol'],
  ['tomates_concassees', 'passata'],
  ['yaourt_nature', 'fromage_blanc'],
  ['patate_douce', 'potiron', 'carotte'],
  ['brocoli', 'chou_fleur'],
]

export const VARIANT_LABEL: Record<VariantKind, string> = {
  vegetarienne: 'Végétarienne', vegetalienne: 'Végétalienne', proteinee: 'Riche en protéines', economique: 'Économique',
  rapide: 'Rapide', equilibree: 'Plus de légumes', gourmande: 'Plus gourmande', sans_allergenes: 'Adaptée à mon profil',
  avec_mon_stock: 'Avec mon stock',
}

export type VariantContext = {
  catalog: Catalog
  profile?: Pick<Profile, 'allergens' | 'excludedIngredients' | 'diet' | 'equipment'>
  pantry?: PantryItem[]
  month?: number
}

export type VariantResult = {
  recipe: Recipe
  /** false = aucune regle ne s'appliquait, la "variante" serait identique a l'original. */
  changed: boolean
}

const VEGGIE_ROTATION = ['courgette', 'carotte', 'epinards_surgeles', 'brocoli', 'poivron', 'haricots_verts_surgeles']

function minConfidence(list: Confidence[]): Confidence {
  if (list.includes('faible')) return 'faible'
  if (list.includes('moyenne')) return 'moyenne'
  return 'haute'
}

function lineHasTag(catalog: Catalog, line: RecipeIngredient, tags: IngredientTag[]): boolean {
  const ing = ingredientOf(catalog, line.ingredientId)
  return ing.tags.some((t) => tags.includes(t))
}

/** Ingredient de remplacement autorise par le profil (pas d'allergene, pas exclu, regime respecte). */
function acceptable(ctx: VariantContext, ingredientId: string): boolean {
  const ing = ctx.catalog.ingredients.get(ingredientId)
  if (!ing) return false
  if (!ctx.profile) return true
  const probe: Recipe = { ...EMPTY_RECIPE, ingredients: [{ ingredientId, quantity: 1, unit: 'g' }] }
  return checkRecipe(probe, { ...ctx.profile, equipment: [] }, ctx.catalog).violations.filter((v) => v.kind !== 'equipement').length === 0
}

const EMPTY_RECIPE: Recipe = {
  id: '_', name: '', description: '', emoji: '', servings: 1, prepMinutes: 0, cookMinutes: 0, difficulty: 1, slots: [],
  course: 'plat', equipment: [], ingredients: [], steps: [], tags: [], storage: { fridgeDays: 0, freezable: false }, source: { kind: 'mijote' },
}

/** Applique une substitution a une ligne et trace le changement. */
function substitute(line: RecipeIngredient, rule: SubstitutionRule): RecipeIngredient {
  return { ...line, ingredientId: rule.to, quantity: line.quantity == null ? null : Math.round(line.quantity * rule.ratio * 100) / 100 }
}

function inPantry(pantry: PantryItem[] | undefined, id: string): boolean {
  return !!pantry?.some((p) => p.ingredientId === id && (p.quantity == null || p.quantity > 0))
}

/** Annote les etapes : "le poulet" -> "le poulet (→ tofu ferme)" plutot que de reecrire le texte au risque d'erreurs. */
function annotateSteps(steps: string[], catalog: Catalog, swaps: { from: string; to: string }[]): string[] {
  if (swaps.length === 0) return steps
  return steps.map((step) => {
    let out = step
    for (const { from, to } of swaps) {
      const f = ingredientOf(catalog, from)
      const t = ingredientOf(catalog, to)
      const names = [f.name, f.plural, ...(f.aliases ?? [])].filter((n): n is string => !!n).sort((a, b) => b.length - a.length)
      for (const n of names) {
        // Mot entier uniquement ("haché" ne doit pas matcher dans "Hacher"), pluriel simple accepte.
        const re = new RegExp(`(?<![\\p{L}])(${escapeRegExp(n)}s?)(?![\\p{L}])(?![^(]*→)`, 'iu')
        if (re.test(out)) {
          out = out.replace(re, `$1 (→ ${t.name.toLowerCase()})`)
          break
        }
      }
    }
    return out
  })
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Produit la version `kind` d'une recette. La recette renvoyee a un id derive (`<id>~<kind>`) pour
 * pouvoir etre planifiee, et porte `variant` avec la liste des changements et la confiance globale.
 */
export function applyVariant(recipe: Recipe, kind: VariantKind, ctx: VariantContext): VariantResult {
  const { catalog } = ctx
  const changes: VariantChange[] = []
  const warnings: string[] = []
  const swaps: { from: string; to: string }[] = []
  let lines = recipe.ingredients.map((l) => ({ ...l }))
  let minutesSaved = 0

  const ruleFor = (line: RecipeIngredient, kinds: VariantKind[], extra?: (r: SubstitutionRule) => boolean) =>
    SUBSTITUTIONS.find((r) => r.from === line.ingredientId && r.kinds.some((k) => kinds.includes(k)) && acceptable(ctx, r.to) && (!extra || extra(r)))

  const swapLine = (i: number, rule: SubstitutionRule) => {
    const from = ingredientOf(catalog, lines[i].ingredientId)
    const to = ingredientOf(catalog, rule.to)
    lines[i] = substitute(lines[i], rule)
    changes.push({ type: 'substitution', from: from.id, to: to.id, ratio: rule.ratio, confidence: rule.confidence, note: rule.note })
    swaps.push({ from: from.id, to: to.id })
    minutesSaved += rule.minutesSaved ?? 0
  }

  const servings = recipe.servings

  switch (kind) {
    case 'vegetarienne':
    case 'vegetalienne':
    case 'sans_allergenes': {
      const target: Pick<Profile, 'allergens' | 'excludedIngredients' | 'diet' | 'equipment'> =
        kind === 'sans_allergenes'
          ? { allergens: ctx.profile?.allergens ?? [], excludedIngredients: ctx.profile?.excludedIngredients ?? [], diet: ctx.profile?.diet ?? 'omnivore', equipment: [] }
          : { allergens: ctx.profile?.allergens ?? [], excludedIngredients: ctx.profile?.excludedIngredients ?? [], diet: kind === 'vegetarienne' ? 'vegetarien' : 'vegetalien', equipment: [] }
      const subCtx: VariantContext = { ...ctx, profile: target }
      for (let i = 0; i < lines.length; i++) {
        const check = checkRecipe({ ...EMPTY_RECIPE, ingredients: [lines[i]] }, target, catalog)
        if (check.violations.length === 0) continue
        const ing = ingredientOf(catalog, lines[i].ingredientId)
        // Les regles vegetaliennes couvrent aussi le vegetarien (ex. bouillon) ; on cherche toutes les regles utiles.
        const rule = SUBSTITUTIONS.find((r) => r.from === lines[i].ingredientId && acceptable(subCtx, r.to) && (kind !== 'vegetarienne' || r.kinds.some((k) => k === 'vegetarienne' || k === 'vegetalienne' || k === 'sans_allergenes')))
          ?? interchangeableFor(lines[i].ingredientId, (id) => acceptable(subCtx, id))
        if (rule) swapLine(i, rule)
        else if (lines[i].optional) {
          changes.push({ type: 'retrait', ingredientId: ing.id, note: `${ing.name} (optionnel) retiré.` })
          lines.splice(i--, 1)
        } else {
          warnings.push(`Pas de remplacement fiable pour : ${ing.name.toLowerCase()}. Cette version n’est pas compatible en l’état.`)
        }
      }
      break
    }
    case 'economique': {
      for (let i = 0; i < lines.length; i++) {
        const rule = ruleFor(lines[i], ['economique'], (r) => {
          const a = ctx.catalog.ingredients.get(r.from)?.pricePerKgOrUnit
          const b = ctx.catalog.ingredients.get(r.to)?.pricePerKgOrUnit
          return a == null || b == null || b * r.ratio < a
        })
        if (rule) swapLine(i, rule)
      }
      break
    }
    case 'rapide': {
      for (let i = 0; i < lines.length; i++) {
        const rule = ruleFor(lines[i], ['rapide'])
        if (rule) swapLine(i, rule)
      }
      break
    }
    case 'proteinee': {
      for (let i = 0; i < lines.length; i++) {
        const rule = ruleFor(lines[i], ['proteinee'])
        if (rule) swapLine(i, rule)
      }
      const hasProtein = lines.some((l) => lineHasTag(catalog, l, ['volaille', 'viande_rouge', 'porc', 'poisson', 'fruits_de_mer', 'proteine_vegetale', 'legumineuse', 'oeuf']))
      if (!hasProtein || changes.length === 0) {
        const candidates: { id: string; qty: number; unit: 'g' | 'piece'; note: string }[] = [
          { id: 'oeuf', qty: 1, unit: 'piece', note: 'Un œuf mollet ou poché par portion, à servir avec le plat.' },
          { id: 'pois_chiches', qty: 60, unit: 'g', note: 'Pois chiches rôtis ou ajoutés en fin de cuisson.' },
          { id: 'tofu_ferme', qty: 60, unit: 'g', note: 'Tofu poêlé en dés.' },
        ]
        const add = candidates.find((c) => acceptable(ctx, c.id) && !lines.some((l) => l.ingredientId === c.id))
        if (add) {
          lines.push({ ingredientId: add.id, quantity: add.qty * servings, unit: add.unit })
          changes.push({ type: 'ajout', ingredientId: add.id, quantity: add.qty * servings, unit: add.unit, note: add.note })
        }
      }
      break
    }
    case 'equilibree': {
      for (let i = 0; i < lines.length; i++) {
        const rule = ruleFor(lines[i], ['equilibree'])
        if (rule) swapLine(i, rule)
      }
      lines = lines.map((l) => {
        if (l.quantity == null) return l
        const ing = ingredientOf(catalog, l.ingredientId)
        if (ing.tags.includes('legume') && !ing.tags.includes('herbe_epice')) {
          changes.push({ type: 'quantite', ingredientId: ing.id, factor: 1.5, note: `+50 % de ${ing.name.toLowerCase()}` })
          return { ...l, quantity: Math.round(l.quantity * 1.5 * 100) / 100 }
        }
        if (ing.tags.includes('feculent')) {
          changes.push({ type: 'quantite', ingredientId: ing.id, factor: 0.75, note: `-25 % de ${ing.name.toLowerCase()} pour faire de la place aux légumes` })
          return { ...l, quantity: Math.round(l.quantity * 0.75 * 100) / 100 }
        }
        if (ing.tags.includes('matiere_grasse') || ing.tags.includes('creme')) {
          changes.push({ type: 'quantite', ingredientId: ing.id, factor: 0.6, note: `Moins de ${ing.name.toLowerCase()}` })
          return { ...l, quantity: Math.round(l.quantity * 0.6 * 100) / 100 }
        }
        return l
      })
      const hasVeg = lines.some((l) => lineHasTag(catalog, l, ['legume']) && !lineHasTag(catalog, l, ['herbe_epice']))
      if (!hasVeg) {
        const month = ctx.month ?? new Date().getMonth() + 1
        const veg = VEGGIE_ROTATION.find((id) => {
          const ing = catalog.ingredients.get(id)
          return ing && acceptable(ctx, id) && (!ing.seasonMonths || ing.seasonMonths.includes(month))
        })
        if (veg) {
          lines.push({ ingredientId: veg, quantity: 100 * servings, unit: 'g' })
          changes.push({ type: 'ajout', ingredientId: veg, quantity: 100 * servings, unit: 'g', note: `${ingredientOf(catalog, veg).name} de saison en accompagnement (poêlé ou vapeur).` })
        }
      }
      break
    }
    case 'gourmande': {
      const cheese = ['parmesan', 'emmental_rape', 'comte'].find((id) => acceptable(ctx, id) && catalog.ingredients.has(id))
      const isSweet = recipe.course === 'dessert' || recipe.course === 'petit_dejeuner' || recipe.course === 'collation'
      if (isSweet) {
        const choc = acceptable(ctx, 'chocolat_noir') ? 'chocolat_noir' : null
        if (choc) {
          lines.push({ ingredientId: choc, quantity: 15 * servings, unit: 'g' })
          changes.push({ type: 'ajout', ingredientId: choc, quantity: 15 * servings, unit: 'g', note: 'Copeaux de chocolat noir sur le dessus.' })
        }
      } else if (cheese && !lines.some((l) => l.ingredientId === cheese)) {
        lines.push({ ingredientId: cheese, quantity: 15 * servings, unit: 'g' })
        changes.push({ type: 'ajout', ingredientId: cheese, quantity: 15 * servings, unit: 'g', note: `${ingredientOf(catalog, cheese).name} en finition, à faire gratiner ou fondre.` })
      }
      lines = lines.map((l) => {
        const ing = ingredientOf(catalog, l.ingredientId)
        if (l.quantity != null && (ing.tags.includes('creme') || ing.tags.includes('fromage')) && !changes.some((c) => c.type === 'ajout' && c.ingredientId === ing.id)) {
          changes.push({ type: 'quantite', ingredientId: ing.id, factor: 1.3, note: `Un peu plus de ${ing.name.toLowerCase()}` })
          return { ...l, quantity: Math.round(l.quantity * 1.3 * 100) / 100 }
        }
        return l
      })
      break
    }
    case 'avec_mon_stock': {
      for (let i = 0; i < lines.length; i++) {
        const id = lines[i].ingredientId
        const ing = ingredientOf(catalog, id)
        if (ing.staple || inPantry(ctx.pantry, id)) continue
        const explicit = SUBSTITUTIONS.find((r) => r.from === id && inPantry(ctx.pantry, r.to) && acceptable(ctx, r.to))
        const rule = explicit ?? interchangeableFor(id, (other) => inPantry(ctx.pantry, other) && acceptable(ctx, other))
        if (rule) swapLine(i, rule)
      }
      break
    }
  }

  // Une meme recette peut citer deux fois le meme ingredient apres substitution : on fusionne.
  lines = mergeSameIngredient(lines)

  if (changes.length === 0 && warnings.length === 0) {
    return { recipe, changed: false }
  }
  if (minutesSaved > 0) {
    changes.push({ type: 'temps', deltaMinutes: -minutesSaved, note: `Environ ${minutesSaved} min de gagnées (estimation).` })
  }

  const confidence = minConfidence(changes.flatMap((c) => (c.type === 'substitution' ? [c.confidence] : c.type === 'ajout' || c.type === 'quantite' ? ['moyenne' as Confidence] : [])))
  const totalSaved = Math.min(minutesSaved, Math.max(0, recipe.prepMinutes + recipe.cookMinutes - 5))
  const cookSaved = Math.min(recipe.cookMinutes, totalSaved)
  const adapted: Recipe = {
    ...recipe,
    id: `${recipe.id}~${kind}`,
    name: recipe.name,
    baseRecipeId: recipe.id,
    ingredients: lines,
    steps: annotateSteps(recipe.steps, catalog, swaps),
    cookMinutes: recipe.cookMinutes - cookSaved,
    prepMinutes: recipe.prepMinutes - (totalSaved - cookSaved),
    variant: { kind, changes, confidence: warnings.length > 0 ? 'faible' : confidence, warnings },
  }
  return { recipe: adapted, changed: true }
}

function interchangeableFor(id: string, ok: (other: string) => boolean): SubstitutionRule | undefined {
  const group = INTERCHANGEABLE.find((g) => g.includes(id))
  const other = group?.find((o) => o !== id && ok(o))
  if (!other) return undefined
  return { from: id, to: other, ratio: 1, kinds: ['avec_mon_stock'], confidence: 'moyenne', note: 'Ingrédient de la même famille : goût proche, à ajuster.' }
}

function mergeSameIngredient(lines: RecipeIngredient[]): RecipeIngredient[] {
  const out: RecipeIngredient[] = []
  for (const l of lines) {
    const same = out.find((o) => o.ingredientId === l.ingredientId && o.unit === l.unit && !!o.optional === !!l.optional)
    if (same && same.quantity != null && l.quantity != null) same.quantity = Math.round((same.quantity + l.quantity) * 100) / 100
    else if (!same) out.push({ ...l })
  }
  return out
}

/** Variante necessaire pour qu'une recette respecte un profil, si elle existe et leve TOUTES les violations. */
export function adaptToProfile(recipe: Recipe, profile: Profile, catalog: Catalog): Recipe | null {
  const check = checkRecipe(recipe, profile, catalog)
  if (check.allowed) return recipe
  if (check.violations.some((v) => v.kind === 'equipement' && !v.optional)) return null
  // Regime vegetarien/vegetalien seul en cause : variante dediee ; sinon (allergies, exclusions,
  // pescetarien) : on ne remplace que les ingredients reellement problematiques pour CE profil.
  const onlyDiet = check.violations.every((v) => v.kind === 'regime')
  const kind: VariantKind = onlyDiet && profile.diet === 'vegetalien' ? 'vegetalienne' : onlyDiet && profile.diet === 'vegetarien' ? 'vegetarienne' : 'sans_allergenes'
  const result = applyVariant(recipe, kind, { catalog, profile })
  if (!result.changed || (result.recipe.variant?.warnings.length ?? 0) > 0) return null
  return checkRecipe(result.recipe, profile, catalog).allowed ? result.recipe : null
}

export function availableVariants(recipe: Recipe, ctx: VariantContext): { kind: VariantKind; result: VariantResult }[] {
  const kinds: VariantKind[] = ['equilibree', 'proteinee', 'economique', 'rapide', 'vegetarienne', 'vegetalienne', 'gourmande']
  if (ctx.pantry && ctx.pantry.length > 0) kinds.push('avec_mon_stock')
  if (ctx.profile && ctx.profile.allergens.length + ctx.profile.excludedIngredients.length > 0) kinds.push('sans_allergenes')
  return kinds
    .map((kind) => ({ kind, result: applyVariant(recipe, kind, ctx) }))
    .filter((v) => v.result.changed && !(v.kind === 'vegetarienne' && isAlready(recipe, ctx.catalog, 'vegetarien')) && !(v.kind === 'vegetalienne' && isAlready(recipe, ctx.catalog, 'vegetalien')))
}

function isAlready(recipe: Recipe, catalog: Catalog, diet: Diet): boolean {
  return checkRecipe(recipe, { allergens: [] as Allergen[], excludedIngredients: [], diet, equipment: [] }, catalog).violations.filter((v) => v.kind === 'regime').length === 0
}

/** Recette effective d'une entree de planning (variante appliquee si demandee). */
export function resolveRecipe(recipe: Recipe, variant: VariantKind | undefined, ctx: VariantContext): Recipe {
  if (!variant) return recipe
  const r = applyVariant(recipe, variant, ctx)
  return r.changed ? r.recipe : recipe
}
