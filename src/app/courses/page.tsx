'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Package, Pencil, Plus, Refrigerator, Repeat, Share2, ShoppingBasket, Trash2, Undo2 } from 'lucide-react'
import type { Aisle, Ingredient, ShoppingListMeta, Unit } from '@/domain/types'
import { useMijote } from '@/data/mijote-provider'
import { computeList, weekListMeta } from '@/data/selectors'
import { addManualItem, createList, deleteList, finishShopping, removeLine, removeManualItem, restoreLine, setLineQuantity, setRecurring, toggleChecked } from '@/data/actions'
import { AISLE_LABEL, AISLE_ORDER, addDays, type ShoppingLine } from '@/domain/shopping'
import { formatBaseQuantity, UNIT_OPTIONS } from '@/domain/units'
import { dayLabel, euro } from '@/lib/format'
import { Page, PageHeader, Card, Chip, Estimate, EmptyState, Note, PrimaryButton, SecondaryButton, Sheet } from '@/components/kit'
import { IngredientSearch } from '@/components/ingredient-picker'

export default function Courses() {
  const { state, update, catalog, today } = useMijote()
  // Si la semaine en cours n'a plus de repas a venir (ex. le week-end), on ouvre directement la suivante.
  const [anchor, setAnchor] = useState(() => {
    const end = weekListMeta(today).to!
    const remainingThisWeek = state.plan.some((e) => e.kind === 'recette' && !e.cookedAt && e.date >= today && e.date <= end)
    const nextWeek = state.plan.some((e) => e.kind === 'recette' && e.date > end && e.date <= addDays(end, 7))
    return !remainingThisWeek && nextWeek ? addDays(today, 7) : today
  })
  const [customId, setCustomId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ShoppingLine | null>(null)
  const [showCovered, setShowCovered] = useState(false)
  const [newList, setNewList] = useState(false)
  const [shared, setShared] = useState<string | null>(null)

  const weekMeta = weekListMeta(anchor)
  const meta: ShoppingListMeta = (customId && state.lists.find((l) => l.id === customId)) || weekMeta
  const list = useMemo(() => computeList(state, catalog, meta, today), [state, catalog, meta, today])
  const lines = list.byAisle.flatMap((g) => g.lines)
  const remaining = lines.filter((l) => !l.checked).length
  const checkedCount = lines.length - remaining

  function quantityLabel(l: ShoppingLine): string {
    const ing = l.ingredientId ? catalog.ingredients.get(l.ingredientId) : undefined
    if (!ing) return l.extra.length ? l.extra.map((e) => `${e.quantity} ${UNIT_OPTIONS.find((u) => u.value === e.unit)?.label ?? e.unit}`).join(' + ') : l.toBuy > 1 ? `× ${l.toBuy}` : ''
    const parts: string[] = []
    if (l.purchase && l.purchase.packs.length > 0 && !(ing.baseUnit === 'piece' && l.purchase.packs.every((p) => p.size === 1))) {
      parts.push(l.purchase.packs.map((p) => `${p.count} × ${formatBaseQuantity(p.size, ing)}`).join(' + '))
    } else if (l.toBuy > 0) {
      const amount = l.purchase?.total ?? l.toBuy
      let text = formatBaseQuantity(amount, ing)
      // Produits vendus au poids mais comptes a la piece (oignons, baguette...) : on donne les deux.
      if (ing.baseUnit === 'g' && ing.pieceGrams && ing.pieceGrams >= 50 && !ing.packages) {
        const pieces = Math.max(0.5, Math.round((amount / ing.pieceGrams) * 2) / 2)
        const name = (pieces > 1 ? ing.plural ?? ing.name : ing.name).toLowerCase()
        text += ` (≈ ${pieces.toLocaleString('fr-FR')} ${name})`
      }
      parts.push(text)
    }
    for (const e of l.extra) parts.push(`${e.quantity} ${UNIT_OPTIONS.find((u) => u.value === e.unit)?.label ?? e.unit}`)
    return parts.join(' + ')
  }

  function detail(l: ShoppingLine): string | null {
    const ing = l.ingredientId ? catalog.ingredients.get(l.ingredientId) : undefined
    if (!ing) return null
    const bits: string[] = []
    if (l.purchase && l.needed > 0 && Math.abs(l.purchase.total - l.toBuy) > 0.5) bits.push(`besoin ${formatBaseQuantity(l.toBuy, ing)}`)
    if (l.fromPantry > 0) bits.push(`${formatBaseQuantity(l.fromPantry, ing)} déjà chez toi`)
    if (l.purchase && l.purchase.leftover >= l.purchase.total * 0.2 && (ing.shelfLifeDays ?? 365) <= 10) bits.push(`il en restera ${formatBaseQuantity(l.purchase.leftover, ing)}`)
    return bits.length ? bits.join(' · ') : null
  }

  async function share() {
    const text = [`🛒 ${meta.name}`, ...list.byAisle.flatMap((g) => [`\n${AISLE_LABEL[g.aisle]}`, ...g.lines.filter((l) => !l.checked).map((l) => `- ${l.label} ${quantityLabel(l)}`.trim())])].join('\n')
    try {
      if (navigator.share) await navigator.share({ title: meta.name, text })
      else {
        await navigator.clipboard.writeText(text)
        setShared('Liste copiée : tu peux la coller dans un message.')
      }
    } catch {
      // partage annule par l'utilisateur : rien a faire
    }
  }

  return (
    <Page>
      <PageHeader eyebrow="Liste de courses" title={meta.mode === 'semaine' ? (weekMeta.from! <= today && today <= weekMeta.to! ? 'Cette semaine' : meta.name) : meta.name}
        action={<button onClick={share} disabled={lines.length === 0} className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center disabled:opacity-40" aria-label="Partager la liste"><Share2 size={18} aria-hidden /></button>} />

      {/* Choix de la liste */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 mb-2" aria-label="Listes">
        <Chip active={!customId} onClick={() => setCustomId(null)}>Semaine</Chip>
        {state.lists.map((l) => <Chip key={l.id} active={customId === l.id} onClick={() => setCustomId(l.id)}>{l.name}</Chip>)}
        <Chip onClick={() => setNewList(true)}><Plus size={14} className="inline -mt-0.5" aria-hidden /> Liste</Chip>
      </div>
      {!customId && (
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setAnchor(addDays(anchor, -7))} className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center" aria-label="Semaine précédente"><ChevronLeft size={18} aria-hidden /></button>
          <p className="text-sm text-muted-foreground">{dayLabel(weekMeta.from!, today, 'short')} → {dayLabel(weekMeta.to!, today, 'short')}</p>
          <button onClick={() => setAnchor(addDays(anchor, 7))} className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center" aria-label="Semaine suivante"><ChevronRight size={18} aria-hidden /></button>
        </div>
      )}

      {/* Resume */}
      <Card className="p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold tabular-nums">{remaining}<span className="text-sm font-medium text-muted-foreground"> article{remaining > 1 ? 's' : ''} à acheter</span></p>
          {list.cost.totalLines > 0 && (
            <p className="text-sm text-muted-foreground">
              <Estimate confidence={list.cost.pricedLines === list.cost.totalLines ? 'moyenne' : 'faible'}>{euro(list.cost.value)}</Estimate>
              {list.cost.pricedLines < list.cost.totalLines && ` (${list.cost.totalLines - list.cost.pricedLines} sans prix)`}
            </p>
          )}
        </div>
        <SecondaryButton onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Ajouter</SecondaryButton>
      </Card>
      <div className="mb-3 space-y-1">
        <Note>Montant à payer estimé, conditionnements compris (il peut dépasser le coût des repas affiché dans le planning).</Note>
        {list.excludedPast > 0 && <Note>{list.excludedPast} repas des jours passés ne sont pas comptés.</Note>}
      </div>
      {list.warnings.map((w, i) => <p key={i} className="text-xs text-warning mb-2">{w}</p>)}
      {shared && <p role="status" className="text-sm text-success mb-2">{shared}</p>}

      {lines.length === 0 ? (
        <EmptyState icon={<ShoppingBasket size={22} />} title="Rien à acheter"
          text={meta.mode === 'semaine' ? 'La liste se remplit toute seule quand tu planifies des repas. Tu peux aussi ajouter des articles à la main.' : 'Ajoute des articles à cette liste.'} />
      ) : (
        <div className="space-y-4">
          {list.byAisle.map((g) => (
            <section key={g.aisle} aria-label={AISLE_LABEL[g.aisle]}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{AISLE_LABEL[g.aisle]}</h2>
              <Card className="divide-y divide-border">
                {g.lines.map((l) => (
                  <div key={l.key} className="flex items-center gap-1 pr-1">
                    <button onClick={() => update((s) => toggleChecked(s, meta.id, l))} role="checkbox" aria-checked={l.checked} className="flex-1 flex items-center gap-3 p-3 text-left min-h-14">
                      <span className={`w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center ${l.checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>{l.checked && <Check size={14} aria-hidden />}</span>
                      <span className={`min-w-0 ${l.checked ? 'line-through text-muted-foreground' : ''}`}>
                        <span className="font-medium">{l.label}</span>
                        <span className="text-sm text-muted-foreground"> {quantityLabel(l)}</span>
                        {l.recurring && <Repeat size={12} className="inline ml-1 text-muted-foreground" aria-label="récurrent" />}
                        {!l.checked && detail(l) && <span className="block text-xs text-muted-foreground">{detail(l)}</span>}
                        {!l.checked && l.sources.length > 0 && <span className="block text-[11px] text-muted-foreground truncate">Pour : {[...new Set(l.sources.map((s) => s.recipeName))].join(', ')}</span>}
                      </span>
                    </button>
                    <button onClick={() => setEditing(l)} className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-muted-foreground" aria-label={`Modifier ${l.label}`}><Pencil size={15} aria-hidden /></button>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      {checkedCount > 0 && (
        <div className="mt-5">
          <PrimaryButton className="w-full" onClick={() => update((s) => finishShopping(s, meta.id, lines, catalog, today))}><Refrigerator size={16} aria-hidden /> Courses faites : ranger {checkedCount} article{checkedCount > 1 ? 's' : ''} dans le frigo</PrimaryButton>
          <div className="mt-2"><Note>Les articles cochés rejoignent ton stock, avec une date de péremption estimée pour les produits frais (modifiable).</Note></div>
        </div>
      )}

      {list.covered.length > 0 && (
        <section className="mt-6">
          <button onClick={() => setShowCovered(!showCovered)} aria-expanded={showCovered} className="w-full flex items-center justify-between text-sm font-semibold min-h-11">
            Déjà chez toi ou à vérifier ({list.covered.length})
            <ChevronDown size={16} className={showCovered ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden />
          </button>
          {showCovered && (
            <Card className="divide-y divide-border">
              {list.covered.map((l) => (
                <div key={l.key} className="p-3 text-sm flex items-center justify-between gap-2">
                  <span>{l.label}</span>
                  <span className="text-xs text-muted-foreground text-right">{l.staple || l.toTaste ? 'placard, à vérifier' : l.stockUnknown ? 'en stock (quantité inconnue)' : 'en stock'}</span>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      {list.removed.length > 0 && (
        <section className="mt-4">
          <p className="text-sm font-semibold mb-1.5">Retirés de la liste</p>
          <Card className="divide-y divide-border">
            {list.removed.map((l) => (
              <div key={l.key} className="pl-3 pr-1 text-sm flex items-center justify-between min-h-12">
                <span className="text-muted-foreground">{l.label}</span>
                <button onClick={() => update((s) => restoreLine(s, meta.id, l.key))} className="min-h-10 px-3 text-primary font-semibold inline-flex items-center gap-1"><Undo2 size={14} aria-hidden /> Remettre</button>
              </div>
            ))}
          </Card>
        </section>
      )}

      {customId && (
        <button onClick={() => { update((s) => deleteList(s, meta.id)); setCustomId(null) }} className="mt-6 w-full text-sm text-danger min-h-11">Supprimer cette liste</button>
      )}

      <AddItemSheet open={adding} onOpenChange={setAdding} listId={meta.id} />
      <EditLineSheet line={editing} onClose={() => setEditing(null)} listId={meta.id} />
      <NewListSheet open={newList} onOpenChange={setNewList} onCreated={(id) => setCustomId(id)} />
    </Page>
  )
}

function AddItemSheet({ open, onOpenChange, listId }: { open: boolean; onOpenChange: (o: boolean) => void; listId: string }) {
  const { update, catalog } = useMijote()
  const [ing, setIng] = useState<Ingredient | null>(null)
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState<Unit>('piece')
  const [aisle, setAisle] = useState<Aisle>('autre')
  const [recurring, setRec] = useState(false)

  function reset() { setIng(null); setLabel(''); setQty(''); setUnit('piece'); setAisle('autre'); setRec(false) }
  function submit() {
    const name = ing?.name ?? label.trim()
    if (!name) return
    const q = qty ? Number(qty.replace(',', '.')) : null
    update((s) => addManualItem(s, { listId: recurring ? null : listId, ingredientId: ing?.id, label: name, quantity: q != null && Number.isFinite(q) ? q : null, unit, aisle: ing?.aisle ?? aisle, recurring, checked: false }))
    reset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }} title="Ajouter un article">
      <div className="space-y-3">
        {ing ? (
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 min-h-11"><span className="font-medium">{ing.name}</span><button className="text-sm text-primary min-h-10" onClick={() => setIng(null)}>Changer</button></div>
        ) : (
          <>
            <IngredientSearch catalog={catalog} onPick={(i) => { setIng(i); setUnit(i.baseUnit === 'piece' ? 'piece' : i.baseUnit) }} placeholder="Ingrédient (riz, lait…)" autoFocus />
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="…ou autre article (éponges, café…)" aria-label="Article libre" className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
            {label && (
              <select value={aisle} onChange={(e) => setAisle(e.target.value as Aisle)} aria-label="Rayon" className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base">
                {AISLE_ORDER.map((a) => <option key={a} value={a}>{AISLE_LABEL[a]}</option>)}
              </select>
            )}
          </>
        )}
        <div className="flex gap-2">
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="Quantité (facultatif)" aria-label="Quantité" className="flex-1 min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unité" className="min-h-11 rounded-xl border border-border bg-card px-2 text-base">
            {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm min-h-11">
          <input type="checkbox" checked={recurring} onChange={(e) => setRec(e.target.checked)} className="w-5 h-5 accent-[var(--primary)]" />
          Produit récurrent (ajouté chaque semaine)
        </label>
        <PrimaryButton className="w-full" onClick={submit} disabled={!ing && !label.trim()}>Ajouter</PrimaryButton>
      </div>
    </Sheet>
  )
}

function EditLineSheet({ line, onClose, listId }: { line: ShoppingLine | null; onClose: () => void; listId: string }) {
  const { update, catalog, state } = useMijote()
  const ing = line?.ingredientId ? catalog.ingredients.get(line.ingredientId) : undefined
  const [qty, setQty] = useState('')
  const manual = line ? state.manual.find((m) => line.manualIds.includes(m.id)) : undefined
  const unitLabel = ing ? (ing.baseUnit === 'piece' ? 'pièces' : ing.baseUnit) : ''

  return (
    <Sheet open={!!line} onOpenChange={(o) => { if (!o) { onClose(); setQty('') } }} title={line?.label ?? ''} description={line && line.sources.length > 0 ? `Pour : ${[...new Set(line.sources.map((s) => s.recipeName))].join(', ')}` : undefined}>
      {line && (
        <div className="space-y-3">
          {ing && line.sources.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1.5">Quantité à acheter ({unitLabel})</p>
              <div className="flex gap-2">
                <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder={String(Math.round(line.purchase?.total ?? line.toBuy))} aria-label="Quantité à acheter" className="flex-1 min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
                <PrimaryButton onClick={() => { const q = Number(qty.replace(',', '.')); if (Number.isFinite(q) && q >= 0) update((s) => setLineQuantity(s, listId, line.key, q)); onClose(); setQty('') }} disabled={!qty}>OK</PrimaryButton>
              </div>
              {line.overridden && <button className="text-sm text-primary mt-2 min-h-10" onClick={() => { update((s) => setLineQuantity(s, listId, line.key, undefined)); onClose() }}>Revenir à la quantité calculée</button>}
              <div className="mt-2"><Note>Ta quantité est conservée même si le planning change. Les conditionnements sont proposés à partir de tailles courantes en magasin.</Note></div>
            </div>
          )}
          {manual && (
            <SecondaryButton className="w-full" onClick={() => { update((s) => setRecurring(s, manual.id, !manual.recurring, listId)); onClose() }}><Repeat size={16} aria-hidden />{manual.recurring ? 'Ne plus ajouter chaque semaine' : 'Ajouter chaque semaine'}</SecondaryButton>
          )}
          <SecondaryButton className="w-full text-danger" onClick={() => {
            if (line.sources.length > 0 || !manual) update((s) => removeLine(s, listId, line.key))
            else update((s) => removeManualItem(s, manual.id, listId))
            onClose()
          }}><Trash2 size={16} aria-hidden /> Retirer de la liste</SecondaryButton>
          {line.sources.length > 0 && <Note>Retirer une ligne calculée la masque pour cette liste ; tu peux la remettre en bas de page.</Note>}
        </div>
      )}
    </Sheet>
  )
}

function NewListSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { update, today } = useMijote()
  const [kind, setKind] = useState<'jour' | 'periode' | 'libre'>('jour')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 3))
  const [name, setName] = useState('')

  function create() {
    let id = ''
    update((s) => {
      const meta = kind === 'jour'
        ? { name: name || `Repas du ${dayLabel(from, today, 'short')}`, mode: 'periode' as const, from, to: from }
        : kind === 'periode'
          ? { name: name || `Du ${dayLabel(from, today, 'short')} au ${dayLabel(to, today, 'short')}`, mode: 'periode' as const, from, to: to < from ? from : to }
          : { name: name || 'Ma liste', mode: 'libre' as const }
      const r = createList(s, meta)
      id = r.id
      return r.state
    })
    onOpenChange(false)
    onCreated(id)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Nouvelle liste" description="Une liste pour une journée, une période ou des achats libres. Pour une seule recette, utilise le bouton depuis la fiche recette.">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Chip active={kind === 'jour'} onClick={() => setKind('jour')}>Une journée</Chip>
          <Chip active={kind === 'periode'} onClick={() => setKind('periode')}>Une période</Chip>
          <Chip active={kind === 'libre'} onClick={() => setKind('libre')}>Libre</Chip>
        </div>
        {kind !== 'libre' && (
          <div className="flex gap-2">
            <label className="flex-1 text-sm">Du<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base mt-1" /></label>
            {kind === 'periode' && <label className="flex-1 text-sm">Au<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base mt-1" /></label>}
          </div>
        )}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (facultatif)" aria-label="Nom de la liste" className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
        <PrimaryButton className="w-full" onClick={create}><Package size={16} aria-hidden /> Créer la liste</PrimaryButton>
      </div>
    </Sheet>
  )
}
