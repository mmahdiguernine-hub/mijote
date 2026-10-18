'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Box, ChefHat, Clock, Refrigerator, Shuffle, Snowflake, Trash2 } from 'lucide-react'
import { useMijote } from '@/data/mijote-provider'
import { proposeBatch, batchTimeline, type BatchProposal } from '@/domain/batch'
import { addDays, buildShoppingList, mealsFromPlan } from '@/domain/shopping'
import { resolveRecipe } from '@/domain/variants'
import { applyBatch, removeBatch } from '@/data/actions'
import { newId } from '@/data/state'
import { dayLabel, euro, minutes } from '@/lib/format'
import { Page, Card, Chip, Estimate, Note, PrimaryButton, SecondaryButton, Section, RecipeThumb, EmptyState } from '@/components/kit'
import { SLOT_LABEL } from '@/domain/planner'

function nextSunday(today: string): string {
  const day = new Date(`${today}T12:00:00`).getDay()
  return addDays(today, day === 0 ? 0 : 7 - day)
}

export default function BatchPage() {
  const { state, update, catalog, today, profile, variantCtx } = useMijote()
  const [cookDate, setCookDate] = useState(() => nextSunday(today))
  const [days, setDays] = useState(4)
  const [count, setCount] = useState<number | null>(null)
  const [seed, setSeed] = useState(1)
  const [applied, setApplied] = useState<string | null>(null)

  const proposal: BatchProposal | null = useMemo(() => {
    if (!profile) return null
    const dates = Array.from({ length: days + 1 }, (_, i) => addDays(cookDate, i))
    let n = 0
    return proposeBatch({
      profile, catalog, cookDate, dates, existing: state.plan, recipeCount: count ?? undefined, pantry: state.pantry,
      history: state.plan.filter((e) => e.date < cookDate), today, seed, idFactory: () => `${newId('e')}${n++}`,
    })
  }, [profile, catalog, cookDate, days, count, seed, state.plan, state.pantry, today])

  const cost = useMemo(() => {
    if (!proposal || proposal.entries.length === 0) return null
    const { meals } = mealsFromPlan(proposal.entries, variantCtx)
    return buildShoppingList(meals, { catalog, pantry: state.pantry, today }).cost
  }, [proposal, variantCtx, catalog, state.pantry, today])

  const sessions = state.batches.filter((b) => b.cookDate >= addDays(today, -7)).sort((a, b) => a.cookDate.localeCompare(b.cookDate))

  return (
    <Page>
      <Link href="/planning" className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center mb-1" aria-label="Retour au planning"><ArrowLeft aria-hidden /></Link>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Préparer à l’avance</p>
      <h1 className="font-heading text-[1.75rem] leading-tight font-semibold mb-5">Batch cooking</h1>

      {sessions.length > 0 && (
        <Section title="Mes sessions">
          <div className="space-y-2">{sessions.map((b) => <SessionCard key={b.id} id={b.id} />)}</div>
        </Section>
      )}

      <Section title="Nouvelle session">
        <Card className="p-4 space-y-4">
          <label className="block text-sm font-medium">Jour de cuisine
            <input type="date" value={cookDate} min={today} onChange={(e) => { setCookDate(e.target.value); setApplied(null) }} className="w-full min-h-11 rounded-xl border border-border bg-background px-3 text-base mt-1" />
          </label>
          <div>
            <p className="text-sm font-medium mb-2">Repas couverts</p>
            <div className="flex gap-2 flex-wrap">{[2, 3, 4, 5].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d} jours</Chip>)}</div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Nombre de plats</p>
            <div className="flex gap-2 flex-wrap">{[null, 2, 3, 4].map((c) => <Chip key={String(c)} active={count === c} onClick={() => setCount(c)}>{c ?? 'Auto'}</Chip>)}</div>
          </div>
        </Card>
      </Section>

      {proposal && proposal.entries.length === 0 ? (
        <EmptyState icon={<ChefHat size={22} />} title="Rien à préparer" text={proposal.warnings[0] ?? 'Tous les repas de la période sont déjà prévus.'} />
      ) : proposal && (
        <>
          <Section title="Ce que tu cuisines" action={<button onClick={() => setSeed(seed + 1)} className="text-sm text-primary font-semibold min-h-10 inline-flex items-center gap-1"><Shuffle size={15} aria-hidden /> Autres plats</button>}>
            <div className="grid gap-2">
              {proposal.recipes.map((r) => (
                <Link key={r.baseId} href={`/recettes/${r.baseId}?portions=${r.servings}`} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <RecipeThumb emoji={r.recipe.emoji} id={r.baseId} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold block truncate">{r.recipe.name}</span>
                    <span className="text-xs text-muted-foreground">{r.servings} portions · {r.meals} repas</span>
                  </span>
                </Link>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <Card className="p-3"><p className="text-xs text-muted-foreground">Session</p><p className="font-bold">≈ {minutes(proposal.totalMinutes)}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Dont actif</p><p className="font-bold">≈ {minutes(proposal.activeMinutes)}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Courses</p><p className="font-bold">{cost ? <Estimate confidence={cost.pricedLines === cost.totalLines ? 'moyenne' : 'faible'}>{euro(cost.value)}</Estimate> : '—'}</p></Card>
            </div>
          </Section>

          <Section title="Les repas couverts">
            <Card className="divide-y divide-border">
              {[...proposal.entries].sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot)).map((e) => {
                const r = catalog.recipesById.get(e.recipeId!)
                const store = proposal.storage.find((s) => s.recipeId === e.recipeId)
                const frozen = store?.freezeFor.includes(e.date)
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="min-w-0"><span className="capitalize text-muted-foreground">{dayLabel(e.date, today, 'short')} · {SLOT_LABEL[e.slot]}</span><span className="block font-medium truncate">{r?.name}</span></span>
                    <span className={`text-xs shrink-0 inline-flex items-center gap-1 ${frozen ? 'text-info' : 'text-muted-foreground'}`}>{frozen ? <><Snowflake size={12} aria-hidden />congelé</> : <><Refrigerator size={12} aria-hidden />frigo</>}</span>
                  </div>
                )
              })}
            </Card>
          </Section>

          <Timeline proposal={proposal} />

          <Section title="Rangement">
            <div className="space-y-2">
              {proposal.storage.map((s) => (
                <Card key={s.recipeId} className="p-3 text-sm">
                  <p className="font-semibold flex items-center gap-1.5"><Box size={14} aria-hidden />{s.recipeName} : {s.boxes} boîte{s.boxes > 1 ? 's' : ''} de {s.servingsPerBox} portion{s.servingsPerBox > 1 ? 's' : ''}</p>
                  <p className="text-muted-foreground mt-0.5">Au frigo jusqu’au {dayLabel(s.fridgeUntil, today, 'short')}.{s.freezeFor.length > 0 && ` Congeler le jour même ${s.freezeFor.length > 1 ? 'les boîtes' : 'la boîte'} du ${s.freezeFor.map((d) => dayLabel(d, today, 'short')).join(', ')} ; décongeler la veille au frigo.`}</p>
                </Card>
              ))}
            </div>
            {proposal.warnings.map((w, i) => <p key={i} className="text-sm text-warning mt-2">{w}</p>)}
          </Section>

          {applied ? (
            <p role="status" className="text-sm text-success mb-4">{applied}</p>
          ) : (
            <PrimaryButton className="w-full mb-2" onClick={() => { update((s) => applyBatch(s, proposal)); setApplied('Ajouté au planning : la liste de courses est à jour (achats rattachés au jour de cuisine).') }}>
              <ChefHat size={16} aria-hidden /> Ajouter au planning
            </PrimaryButton>
          )}
          <Note>Durées estimées à partir des recettes : prévois de la marge la première fois. Les courses de la session apparaissent dans la liste de la semaine du jour de cuisine.</Note>
        </>
      )}
    </Page>
  )
}

function Timeline({ proposal }: { proposal: Pick<BatchProposal, 'timeline'> }) {
  return (
    <Section title="Déroulé de la session">
      <ol className="relative border-l-2 border-border ml-2 space-y-3">
        {proposal.timeline.map((s, i) => (
          <li key={i} className="pl-4 relative">
            <span className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ${s.kind === 'actif' ? 'bg-primary' : 'bg-muted-foreground/40'}`} aria-hidden />
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} aria-hidden />{s.at === 0 ? 'Début' : `+ ${minutes(s.at)}`} · {s.kind === 'actif' ? 'actif' : 'pendant que ça cuit'}</p>
            <p className="text-sm"><span className="font-semibold">{s.recipeName}</span> — {s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function SessionCard({ id }: { id: string }) {
  const { state, update, catalog, today, variantCtx } = useMijote()
  const [open, setOpen] = useState(false)
  const session = state.batches.find((b) => b.id === id)!
  const entries = state.plan.filter((e) => e.batchId === id)
  const cooked = entries.filter((e) => e.kind === 'recette')
  const recipes = cooked.flatMap((e) => {
    const base = catalog.recipesById.get(e.recipeId!)
    return base ? [{ recipe: resolveRecipe(base, e.variant, variantCtx), baseId: base.id, factor: e.servings / base.servings }] : []
  })
  const t = batchTimeline(recipes)
  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="text-left min-w-0 flex-1">
          <p className="font-semibold capitalize">{dayLabel(session.cookDate, today)}</p>
          <p className="text-xs text-muted-foreground truncate">{recipes.map((r) => r.recipe.name).join(' · ')} · {entries.length} repas</p>
        </button>
        <button onClick={() => update((s) => removeBatch(s, id))} className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground" aria-label="Annuler cette session"><Trash2 size={15} aria-hidden /></button>
      </div>
      {open && <div className="mt-3"><Timeline proposal={t} /><SecondaryButton className="w-full" onClick={() => setOpen(false)}>Fermer</SecondaryButton></div>}
    </Card>
  )
}
