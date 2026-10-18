'use client'

import { useId, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Catalog } from '@/domain/catalog'
import { normalizeText } from '@/domain/catalog'
import type { Ingredient } from '@/domain/types'

/** Recherche d'ingredients du referentiel (tolerante aux accents et pluriels). */
export function searchIngredients(catalog: Catalog, query: string, limit = 8): Ingredient[] {
  const q = normalizeText(query)
  if (q.length < 2) return []
  const scored: { ing: Ingredient; s: number }[] = []
  for (const ing of catalog.ingredients.values()) {
    const names = [ing.name, ing.plural, ...(ing.aliases ?? [])].filter((n): n is string => !!n).map(normalizeText)
    const best = Math.min(...names.map((n) => (n.startsWith(q) ? 0 : n.includes(q) ? 1 : 9)))
    if (best < 9) scored.push({ ing, s: best })
  }
  return scored.sort((a, b) => a.s - b.s || a.ing.name.localeCompare(b.ing.name, 'fr')).slice(0, limit).map((x) => x.ing)
}

export function IngredientSearch({ catalog, onPick, placeholder, exclude = [], autoFocus }: { catalog: Catalog; onPick: (ing: Ingredient) => void; placeholder?: string; exclude?: string[]; autoFocus?: boolean }) {
  const [query, setQuery] = useState('')
  const listId = useId()
  const results = useMemo(() => searchIngredients(catalog, query).filter((i) => !exclude.includes(i.id)), [catalog, query, exclude])
  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Chercher un ingrédient'}
        aria-label={placeholder ?? 'Chercher un ingrédient'}
        aria-controls={listId}
        autoFocus={autoFocus}
        className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring/40"
      />
      {results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {results.map((ing) => (
            <li key={ing.id} role="option" aria-selected={false}>
              <button type="button" className="w-full text-left px-3 min-h-11 hover:bg-muted text-sm" onClick={() => { onPick(ing); setQuery('') }}>
                {ing.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function IngredientPicker({ catalog, selected, onChange, placeholder }: { catalog: Catalog; selected: string[]; onChange: (ids: string[]) => void; placeholder?: string }) {
  return (
    <div>
      <IngredientSearch catalog={catalog} placeholder={placeholder} exclude={selected} onPick={(ing) => onChange([...selected, ing.id])} />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 pl-3 pr-1 min-h-9 rounded-full bg-muted text-sm">
              {catalog.ingredients.get(id)?.name ?? id}
              <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center" aria-label={`Retirer ${catalog.ingredients.get(id)?.name ?? id}`} onClick={() => onChange(selected.filter((x) => x !== id))}>
                <X size={14} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
