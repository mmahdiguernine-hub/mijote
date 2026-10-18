'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Lock, LockOpen, Plus, RefreshCw, Sparkles, Trash2, ArrowRightLeft, ChefHat, Footprints, Repeat, Eye } from 'lucide-react'
import type { MealSlot, PlanEntry } from '@/domain/types'
import { useMijote } from '@/data/mijote-provider'
import { SLOT_LABEL, SLOT_ORDER, alternativesFor, weekDates, budgetForDates } from '@/domain/planner'
import { addDays } from '@/domain/shopping'
import { analyzeCached } from '@/domain/analysis'
import { resolveRecipe } from '@/domain/variants'
import { suggestRecipes } from '@/domain/scoring'
import { addMeal, generateDays, markCooked, moveMeal, removeMeal, replaceMeal, setEatingOut, setMealServings, toggleLock } from '@/data/actions'
import { dayLabel, euro } from '@/lib/format'
import { Page, PageHeader, Card, Estimate, PrimaryButton, SecondaryButton, Sheet, Stepper, RecipeThumb, Note } from '@/components/kit'
import { RecipeCard } from '@/components/recipe-card'

export default function Planning() {
  const { state, update, catalog, today, profile, variantCtx, scoreCtx } = useMijote()
  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<'actions' | 'remplacer' | 'deplacer'>('actions')
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [seed, setSeed] = useState(1)

  const days = weekDates(anchor)
  const slots = (profile?.slots ?? ['dejeuner', 'diner']).slice().sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b))
  const weekEntries = state.plan.filter((e) => e.date >= days[0] && e.date <= days[6])
  const entry = selected ? state.plan.find((e) => e.id === selected) ?? null : null
  const futureDays = days.filter((d) => d >= today)

  const cost = useMemo(() => weekEntries.reduce((s, e) => {
    if (e.kind !== 'recette' || !e.recipeId) return s
    const r = catalog.recipesById.get(e.recipeId)
    if (!r) return s
    const a = analyzeCached(resolveRecipe(r, e.variant, variantCtx), catalog)
    return s + a.costPerServing.value * e.servings
  }, 0), [weekEntries, catalog, variantCtx])
  const budget = profile ? budgetForDates(profile, days) : undefined

  function generate(keepExisting: boolean) {
    const nextSeed = seed + 1
    setSeed(nextSeed)
    let w: string[] = []
    update((s) => {
      const r = generateDays(s, catalog, futureDays, { keepExisting, seed: nextSeed * 7919 + Date.parse(days[0]) / 86400000, today })
      w = r.warnings
      return r.state
    })
    setWarnings(w)
    setConfirmRegen(false)
  }

  const alternatives = useMemo(() => {
    if (!entry || !profile || mode !== 'remplacer') return []
    return alternativesFor(entry, state.plan, { profile, catalog, pantry: state.pantry, today, limit: 8, seed })
  }, [entry, profile, mode, state.plan, catalog, state.pantry, today, seed])

  const addSuggestions = useMemo(() => {
    if (!adding || !scoreCtx) return []
    const inWeek = new Set(weekEntries.map((e) => e.recipeId).filter(Boolean) as string[])
    return suggestRecipes(scoreCtx, { slot: adding.slot, limit: 8, exclude: inWeek })
  }, [adding, scoreCtx, weekEntries])

  const closeEntry = () => { setSelected(null); setMode('actions') }

  return (
    <Page>
      <PageHeader eyebrow="Planning des repas" title={days[0] <= today && today <= days[6] ? 'Cette semaine' : `Semaine du ${dayLabel(days[0], today)}`} />

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setAnchor(addDays(anchor, -7))} className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center" aria-label="Semaine précédente"><ChevronLeft size={18} aria-hidden /></button>
        <div className="text-center text-sm">
          <p className="font-semibold">Coût des repas : <Estimate confidence="moyenne">{euro(cost)}</Estimate></p>
          {budget != null && <p className={`text-xs ${cost > budget ? 'text-warning' : 'text-muted-foreground'}`}>Budget : {euro(budget)}{cost > budget ? ' · dépassé' : ''}</p>}
        </div>
        <button onClick={() => setAnchor(addDays(anchor, 7))} className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center" aria-label="Semaine suivante"><ChevronRight size={18} aria-hidden /></button>
      </div>

      {futureDays.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <PrimaryButton onClick={() => generate(true)}><Sparkles size={16} aria-hidden /> Compléter la semaine</PrimaryButton>
          <SecondaryButton onClick={() => setConfirmRegen(true)} disabled={weekEntries.length === 0}><RefreshCw size={16} aria-hidden /> Tout reproposer</SecondaryButton>
        </div>
      )}
      <div className="mb-5"><Note>Les repas verrouillés <Lock size={11} className="inline" aria-label="verrouillés" /> et les repas à l’extérieur ne sont jamais modifiés automatiquement.</Note></div>
      {warnings.length > 0 && <div role="status" className="rounded-xl bg-warning/10 text-warning text-sm p-3 mb-4">{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}

      <div className="space-y-3">
        {days.map((d) => (
          <Card key={d} id={d} className={`p-3.5 scroll-mt-4 ${d === today ? 'ring-2 ring-primary/40' : ''} ${d < today ? 'opacity-75' : ''}`}>
            <p className="text-sm font-semibold capitalize mb-2">{dayLabel(d, today)}</p>
            <div className="space-y-2">
              {slots.map((slot) => {
                const e = weekEntries.find((x) => x.date === d && x.slot === slot)
                return <div key={slot}>{slotRow(slot, e, () => e && setSelected(e.id), () => setAdding({ date: d, slot }))}</div>
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Actions sur un repas */}
      <Sheet open={!!entry} onOpenChange={(o) => !o && closeEntry()} title={entry ? entryTitle(entry) : ''} description={entry ? `${dayLabel(entry.date, today)} · ${SLOT_LABEL[entry.slot]}` : undefined}>
        {entry && mode === 'actions' && (
          <div className="space-y-3">
            {entry.kind === 'recette' && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Portions{entry.leftoverServings ? ` (dont ${entry.leftoverServings} pour un reste)` : ''}</span>
                <Stepper label="portions" value={entry.servings} min={(entry.leftoverServings ?? 0) + 1} onChange={(v) => update((s) => setMealServings(s, entry.id, v))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {entry.recipeId && <Link href={`/recettes/${entry.recipeId}?portions=${entry.servings}${entry.variant ? `&version=${entry.variant}` : ''}`} className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl bg-card border border-border text-sm font-semibold"><Eye size={16} aria-hidden /> Voir la recette</Link>}
              {entry.kind !== 'reste' && <SecondaryButton onClick={() => setMode('remplacer')}><Repeat size={16} aria-hidden /> Remplacer</SecondaryButton>}
              <SecondaryButton onClick={() => setMode('deplacer')}><ArrowRightLeft size={16} aria-hidden /> Déplacer</SecondaryButton>
              <SecondaryButton onClick={() => update((s) => toggleLock(s, entry.id))}>{entry.locked ? <><LockOpen size={16} aria-hidden /> Déverrouiller</> : <><Lock size={16} aria-hidden /> Verrouiller</>}</SecondaryButton>
              {entry.kind === 'recette' && !entry.cookedAt && <SecondaryButton onClick={() => { update((s) => markCooked(s, entry.id, catalog)); closeEntry() }}><ChefHat size={16} aria-hidden /> C’est cuisiné</SecondaryButton>}
              <SecondaryButton className="text-danger" onClick={() => { update((s) => removeMeal(s, entry.id)); closeEntry() }}><Trash2 size={16} aria-hidden /> Retirer</SecondaryButton>
            </div>
            {entry.kind === 'recette' && !entry.cookedAt && <Note>« C’est cuisiné » retire les ingrédients utilisés de ton frigo et le repas de ta liste de courses.</Note>}
            {entry.cookedAt && <p className="text-sm text-success">Cuisiné ✓</p>}
          </div>
        )}
        {entry && mode === 'remplacer' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">Suggestions pour ce créneau</p>
              <button className="text-sm text-primary font-semibold min-h-10" onClick={() => setSeed(seed + 1)}>Autres idées</button>
            </div>
            {alternatives.map((s) => (
              <button key={s.recipe.id} className="w-full text-left" onClick={() => { update((st) => replaceMeal(st, entry.id, s.recipe, catalog)); closeEntry() }}>
                <RecipeCard item={s} asLink={false} />
              </button>
            ))}
            {alternatives.length === 0 && <p className="text-sm text-muted-foreground">Aucune autre recette compatible pour ce créneau.</p>}
          </div>
        )}
        {entry && mode === 'deplacer' && (
          <div className="space-y-3">
            {days.filter((d) => d >= today).map((d) => (
              <div key={d}>
                <p className="text-sm font-semibold capitalize mb-1.5">{dayLabel(d, today)}</p>
                <div className="flex gap-2 flex-wrap">
                  {slots.map((slot) => {
                    const here = d === entry.date && slot === entry.slot
                    const occ = weekEntries.find((x) => x.date === d && x.slot === slot)
                    return (
                      <button key={slot} disabled={here} onClick={() => { update((s) => moveMeal(s, entry.id, d, slot)); closeEntry() }} className="px-3 min-h-10 rounded-xl border border-border bg-card text-sm disabled:opacity-40 text-left">
                        {SLOT_LABEL[slot]}{occ && !here && <span className="block text-[11px] text-muted-foreground">échange</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {/* Ajouter un repas */}
      <Sheet open={!!adding} onOpenChange={(o) => !o && setAdding(null)} title="Ajouter un repas" description={adding ? `${dayLabel(adding.date, today)} · ${SLOT_LABEL[adding.slot]}` : undefined}>
        {adding && (
          <div className="space-y-2">
            <SecondaryButton className="w-full" onClick={() => { update((s) => setEatingOut(s, adding.date, adding.slot)); setAdding(null) }}><Footprints size={16} aria-hidden /> Je mange à l’extérieur</SecondaryButton>
            <p className="text-sm text-muted-foreground pt-2">Suggestions pour toi</p>
            {addSuggestions.map((s) => (
              <button key={s.recipe.id} className="w-full text-left" onClick={() => { update((st) => addMeal(st, adding.date, adding.slot, s.recipe, profile?.householdSize ?? 2)); setAdding(null) }}>
                <RecipeCard item={s} asLink={false} />
              </button>
            ))}
            <Link href="/recettes" className="block text-center text-sm text-primary font-semibold min-h-11 pt-3">Chercher une autre recette</Link>
          </div>
        )}
      </Sheet>

      <Sheet open={confirmRegen} onOpenChange={setConfirmRegen} title="Tout reproposer ?" description="Les repas non verrouillés des jours à venir seront remplacés par de nouvelles suggestions.">
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton onClick={() => setConfirmRegen(false)}>Annuler</SecondaryButton>
          <PrimaryButton onClick={() => generate(false)}>Reproposer</PrimaryButton>
        </div>
      </Sheet>
    </Page>
  )

  function entryTitle(e: PlanEntry): string {
    if (e.kind === 'exterieur') return 'Repas à l’extérieur'
    const r = e.recipeId ? catalog.recipesById.get(e.recipeId) : undefined
    return (e.kind === 'reste' ? 'Reste : ' : '') + (r?.name ?? 'Recette inconnue')
  }

  function slotRow(slot: MealSlot, e: PlanEntry | undefined, onOpen: () => void, onAdd: () => void) {
    if (!e) {
      return (
        <button onClick={onAdd} className="w-full flex items-center gap-3 rounded-xl border border-dashed border-border p-2.5 text-sm text-muted-foreground min-h-14">
          <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Plus size={16} aria-hidden /></span>
          {SLOT_LABEL[slot]} · ajouter
        </button>
      )
    }
    const r = e.recipeId ? catalog.recipesById.get(e.recipeId) : undefined
    const source = e.leftoverOf ? state.plan.find((x) => x.id === e.leftoverOf) : undefined
    return (
      <button onClick={onOpen} className={`w-full flex items-center gap-3 rounded-xl p-2.5 text-left min-h-14 ${e.cookedAt ? 'bg-muted/60' : 'bg-background/60'}`}>
        {e.kind === 'exterieur' ? <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg" aria-hidden>🚶</span> : <RecipeThumb emoji={r?.emoji ?? '❓'} id={e.recipeId ?? 'x'} size={40} />}
        <span className="min-w-0 flex-1">
          <span className="text-[11px] text-muted-foreground block">{SLOT_LABEL[slot]}{e.kind === 'reste' ? ` · reste du ${source ? dayLabel(source.date, today, 'short') : 'repas précédent'}` : ''}{e.kind === 'recette' ? ` · ${e.servings} pers.` : ''}</span>
          <span className={`text-sm font-semibold block truncate ${e.cookedAt ? 'line-through text-muted-foreground' : ''}`}>{e.kind === 'exterieur' ? 'À l’extérieur' : r?.name ?? 'Recette inconnue'}</span>
        </span>
        {e.locked && <Lock size={14} className="text-muted-foreground shrink-0" aria-label="Verrouillé" />}
        {e.variant && <span className="text-[10px] px-1.5 py-0.5 rounded bg-herb/15 text-herb shrink-0">adaptée</span>}
      </button>
    )
  }
}
