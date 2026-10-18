'use client'

import { useMemo, useState } from 'react'
import { Plus, Refrigerator, Trash2, TriangleAlert, Pencil } from 'lucide-react'
import type { Ingredient, PantryItem, Unit } from '@/domain/types'
import { useMijote } from '@/data/mijote-provider'
import { expiryStatus, type ExpiryStatus } from '@/domain/pantry'
import { searchRecipes } from '@/domain/search'
import { addDays, AISLE_LABEL } from '@/domain/shopping'
import { formatAmount, UNIT_OPTIONS } from '@/domain/units'
import { upsertPantry, removePantry } from '@/data/actions'
import { newId } from '@/data/state'
import { dayLabel } from '@/lib/format'
import { Page, PageHeader, Section, Card, EmptyState, PrimaryButton, SecondaryButton, Sheet, Note, Chip } from '@/components/kit'
import { IngredientSearch } from '@/components/ingredient-picker'
import { RecipeCard } from '@/components/recipe-card'

const STATUS: Record<ExpiryStatus, { label: string; cls: string; order: number }> = {
  perime: { label: 'Périmé', cls: 'bg-danger/10 text-danger', order: 0 },
  aujourdhui: { label: 'Aujourd’hui', cls: 'bg-warning/15 text-warning', order: 1 },
  bientot: { label: 'Bientôt', cls: 'bg-warning/10 text-warning', order: 2 },
  ok: { label: '', cls: 'text-muted-foreground', order: 3 },
  inconnu: { label: '', cls: 'text-muted-foreground', order: 4 },
}

export default function Frigo() {
  const { state, update, catalog, today, scoreCtx } = useMijote()
  const [editing, setEditing] = useState<PantryItem | 'new' | null>(null)

  const items = [...state.pantry].sort((a, b) => STATUS[expiryStatus(a, today)].order - STATUS[expiryStatus(b, today)].order || (a.expiresOn ?? '9').localeCompare(b.expiresOn ?? '9'))
  const urgent = items.filter((p) => ['aujourdhui', 'bientot'].includes(expiryStatus(p, today)))
  const expired = items.filter((p) => expiryStatus(p, today) === 'perime')
  const ideas = useMemo(() => (scoreCtx && state.pantry.length > 0 ? searchRecipes({ ingredients: [], tags: [], leftovers: true }, scoreCtx, 4).results : []), [scoreCtx, state.pantry.length])

  return (
    <Page>
      <PageHeader eyebrow="Frigo et placards" title="Mon stock" action={<button onClick={() => setEditing('new')} className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center" aria-label="Ajouter un produit"><Plus size={20} aria-hidden /></button>} />

      {items.length === 0 ? (
        <EmptyState icon={<Refrigerator size={22} />} title="Ton stock est vide"
          text="Ajoute ce que tu as déjà : Mijote le déduira de ta liste de courses et te proposera des recettes pour l’utiliser avant qu’il ne se perde."
          action={<PrimaryButton onClick={() => setEditing('new')}><Plus size={16} aria-hidden /> Ajouter un produit</PrimaryButton>} />
      ) : (
        <>
          {(urgent.length > 0 || expired.length > 0) && (
            <div role="status" className="rounded-2xl bg-warning/10 p-3.5 mb-5 text-sm">
              <p className="font-semibold text-warning flex items-center gap-1.5"><TriangleAlert size={15} aria-hidden />
                {urgent.length > 0 ? `${urgent.length} produit${urgent.length > 1 ? 's' : ''} à consommer vite` : `${expired.length} produit${expired.length > 1 ? 's' : ''} périmé${expired.length > 1 ? 's' : ''}`}
              </p>
              {urgent.length > 0 && <p className="text-foreground/80 mt-0.5">{urgent.map((p) => catalog.ingredients.get(p.ingredientId)?.name).join(', ')}</p>}
            </div>
          )}

          {ideas.length > 0 && (
            <Section title="Que cuisiner avec ?">
              <div className="grid gap-2">{ideas.map((s) => <RecipeCard key={s.recipe.id} item={s} />)}</div>
            </Section>
          )}

          <Section title={`${items.length} produit${items.length > 1 ? 's' : ''}`}>
            <Card className="divide-y divide-border">
              {items.map((p) => {
                const ing = catalog.ingredients.get(p.ingredientId)
                const st = expiryStatus(p, today)
                return (
                  <button key={p.id} onClick={() => setEditing(p)} className="w-full flex items-center justify-between gap-3 p-3 text-left min-h-14">
                    <span className="min-w-0">
                      <span className="font-medium block">{ing?.name ?? p.ingredientId}</span>
                      <span className="text-xs text-muted-foreground">{p.quantity == null ? 'Quantité non précisée' : ing ? formatAmount(p.quantity, p.unit, ing) : p.quantity}{ing ? ` · ${AISLE_LABEL[ing.aisle]}` : ''}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {p.expiresOn && <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[st].cls}`}>{STATUS[st].label || dayLabel(p.expiresOn, today, 'short')}{p.expiryEstimated ? ' (estimé)' : ''}</span>}
                      <Pencil size={14} className="text-muted-foreground" aria-hidden />
                    </span>
                  </button>
                )
              })}
            </Card>
          </Section>
          <Note>Bientôt : ajout par scan de code-barres ou photo. Le stock est déjà prévu pour (source de chaque produit).</Note>
        </>
      )}

      <PantrySheet item={editing} onClose={() => setEditing(null)} onSave={(it) => { update((s) => upsertPantry(s, it)); setEditing(null) }} onDelete={(id) => { update((s) => removePantry(s, id)); setEditing(null) }} />
    </Page>
  )
}

function PantrySheet({ item, onClose, onSave, onDelete }: { item: PantryItem | 'new' | null; onClose: () => void; onSave: (p: PantryItem) => void; onDelete: (id: string) => void }) {
  const { catalog, today } = useMijote()
  const existing = item && item !== 'new' ? item : null
  const key = existing?.id ?? (item ? 'new' : 'closed')
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()} title={existing ? catalog.ingredients.get(existing.ingredientId)?.name ?? 'Produit' : 'Ajouter au stock'}>
      {item && <PantryForm key={key} existing={existing} today={today} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  )
}

function PantryForm({ existing, today, onSave, onDelete }: { existing: PantryItem | null; today: string; onSave: (p: PantryItem) => void; onDelete: (id: string) => void }) {
  const { catalog } = useMijote()
  const [ing, setIng] = useState<Ingredient | null>(existing ? catalog.ingredients.get(existing.ingredientId) ?? null : null)
  const [qty, setQty] = useState(existing?.quantity != null ? String(existing.quantity) : '')
  const [unknown, setUnknown] = useState(existing ? existing.quantity == null : false)
  const [unit, setUnit] = useState<Unit>(existing?.unit ?? 'g')
  const [expires, setExpires] = useState(existing?.expiresOn ?? '')

  function pick(i: Ingredient) {
    setIng(i)
    setUnit(i.baseUnit === 'piece' ? 'piece' : i.baseUnit)
    if (i.shelfLifeDays != null && i.shelfLifeDays <= 14 && !expires) setExpires(addDays(today, i.shelfLifeDays))
  }

  function save() {
    if (!ing) return
    const q = Number(qty.replace(',', '.'))
    onSave({
      id: existing?.id ?? newId('p'), ingredientId: ing.id, quantity: unknown || !qty ? null : Number.isFinite(q) ? q : null, unit,
      expiresOn: expires || undefined, expiryEstimated: existing?.expiresOn === expires ? existing?.expiryEstimated : undefined,
      addedOn: existing?.addedOn ?? today, source: existing?.source ?? 'manuel',
    })
  }

  return (
    <div className="space-y-3">
      {!existing && (ing ? (
        <div className="flex items-center justify-between rounded-xl bg-muted px-3 min-h-11"><span className="font-medium">{ing.name}</span><button className="text-sm text-primary min-h-10" onClick={() => setIng(null)}>Changer</button></div>
      ) : <IngredientSearch catalog={catalog} onPick={pick} placeholder="Quel produit ?" autoFocus />)}
      <div className="flex gap-2">
        <input value={qty} onChange={(e) => { setQty(e.target.value); setUnknown(false) }} disabled={unknown} inputMode="decimal" placeholder="Quantité" aria-label="Quantité" className="flex-1 min-h-11 rounded-xl border border-border bg-card px-3 text-base disabled:opacity-50" />
        <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} disabled={unknown} aria-label="Unité" className="min-h-11 rounded-xl border border-border bg-card px-2 text-base disabled:opacity-50">
          {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm min-h-11">
        <input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} className="w-5 h-5 accent-[var(--primary)]" />
        J’en ai, sans savoir combien
      </label>
      <div>
        <label className="text-sm font-medium" htmlFor="exp">À consommer avant (facultatif)</label>
        <input id="exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base mt-1" />
        <div className="flex gap-2 mt-2">
          {[2, 5, 7, 30].map((d) => <Chip key={d} onClick={() => setExpires(addDays(today, d))} className="!min-h-8 text-xs">+{d} j</Chip>)}
          {expires && <Chip onClick={() => setExpires('')} className="!min-h-8 text-xs">Aucune</Chip>}
        </div>
      </div>
      <PrimaryButton className="w-full" onClick={save} disabled={!ing}>{existing ? 'Enregistrer' : 'Ajouter au stock'}</PrimaryButton>
      {existing && <SecondaryButton className="w-full text-danger" onClick={() => onDelete(existing.id)}><Trash2 size={16} aria-hidden /> Retirer du stock</SecondaryButton>}
    </div>
  )
}
