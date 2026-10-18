'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, X, SearchX } from 'lucide-react'
import type { CourseType } from '@/domain/types'
import { useMijote } from '@/data/mijote-provider'
import { parseQuery, searchRecipes, filterChips, type QueryFilters } from '@/domain/search'
import { Page, PageHeader, Chip, EmptyState } from '@/components/kit'
import { RecipeCard } from '@/components/recipe-card'

type Quick = 'rapide' | 'economique' | 'vege' | 'proteine' | 'gourmand' | 'leger' | 'stock'
const QUICK: { key: Quick; label: string }[] = [
  { key: 'rapide', label: '⏱ Rapide' },
  { key: 'economique', label: '💶 Économique' },
  { key: 'leger', label: '🥗 Équilibré' },
  { key: 'proteine', label: '💪 Protéiné' },
  { key: 'vege', label: '🌱 Végé' },
  { key: 'gourmand', label: '😋 Gourmand' },
  { key: 'stock', label: '🧊 Avec mon stock' },
]
const COURSES: { key: CourseType | 'tout'; label: string }[] = [
  { key: 'tout', label: 'Tout' }, { key: 'plat', label: 'Plats' }, { key: 'soupe', label: 'Soupes' }, { key: 'salade', label: 'Salades' },
  { key: 'petit_dejeuner', label: 'Petits-déj' }, { key: 'dessert', label: 'Desserts' },
]

const EXAMPLES = ['J’ai des courgettes et du poulet', 'Un plat sain en moins de 20 min', 'Riche en protéines pour moins de 3 €', 'Quelque chose de gourmand ce soir']

function Recettes() {
  const params = useSearchParams()
  const { scoreCtx, catalog, state } = useMijote()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [quick, setQuick] = useState<Set<Quick>>(new Set())
  const [course, setCourse] = useState<CourseType | 'tout'>('tout')

  const { filters, results } = useMemo(() => {
    const f: QueryFilters = parseQuery(query, catalog)
    if (quick.has('rapide')) f.maxMinutes = Math.min(f.maxMinutes ?? 99, 25)
    if (quick.has('economique')) f.maxCostPerServing = Math.min(f.maxCostPerServing ?? 99, 2.5)
    if (quick.has('proteine')) f.minProtein = 25
    if (quick.has('vege')) f.diet = f.diet ?? 'vegetarien'
    if (quick.has('gourmand')) f.indulgent = true
    if (quick.has('leger')) f.healthy = true
    if (quick.has('stock')) f.leftovers = true
    if (course !== 'tout') {
      if (course === 'dessert') f.course = 'dessert'
      else f.course = course
    }
    if (!scoreCtx) return { filters: f, results: [] }
    return searchRecipes(f, scoreCtx, 60)
  }, [query, quick, course, catalog, scoreCtx])

  const chips = query.trim() ? filterChips(filters, catalog) : []
  const toggle = (k: Quick) => setQuick((cur) => {
    const n = new Set(cur)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    return n
  })

  return (
    <Page>
      <PageHeader eyebrow={`${catalog.recipes.length} recettes`} title="Découvrir" />

      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Un plat, un ingrédient, une envie…"
          aria-label="Rechercher une recette"
          className="w-full min-h-12 rounded-2xl border border-border bg-card pl-10 pr-10 text-base outline-none focus:ring-2 focus:ring-ring/40"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center" aria-label="Effacer la recherche">
            <X size={18} aria-hidden />
          </button>
        )}
      </form>

      {chips.length > 0 && (
        <p className="text-xs text-muted-foreground mb-3" aria-live="polite">Compris : {chips.join(' · ')}</p>
      )}
      {!query && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 mb-1">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setQuery(ex)} className="shrink-0 text-xs px-3 min-h-8 rounded-full bg-muted text-muted-foreground">« {ex} »</button>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2" aria-label="Filtres rapides">
        {QUICK.filter((q) => q.key !== 'stock' || state.pantry.length > 0).map((q) => <Chip key={q.key} active={quick.has(q.key)} onClick={() => toggle(q.key)}>{q.label}</Chip>)}
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-3 mb-2" aria-label="Type de plat">
        {COURSES.map((c) => <Chip key={c.key} active={course === c.key} onClick={() => setCourse(c.key)} className="!min-h-8 text-xs">{c.label}</Chip>)}
      </div>

      {results.length === 0 ? (
        <EmptyState icon={<SearchX size={22} />} title="Aucune recette ne correspond" text="Essaie d’enlever un filtre, ou décris autrement ton envie. Les recettes incompatibles avec tes allergies ne sont jamais affichées." />
      ) : (
        <div className="grid gap-2" aria-live="polite">
          {results.map((s) => <RecipeCard key={s.recipe.id} item={s} />)}
        </div>
      )}
    </Page>
  )
}

export default function RecettesPage() {
  return <Suspense><Recettes /></Suspense>
}
