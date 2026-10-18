'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CalendarPlus, Check, Clock, Gauge, Leaf, Refrigerator, ShoppingBasket, Snowflake, TriangleAlert, Users, Wand2 } from 'lucide-react'
import type { MealSlot, VariantKind } from '@/domain/types'
import { useMijote } from '@/data/mijote-provider'
import { analyzeRecipe } from '@/domain/analysis'
import { checkRecipe, ALLERGEN_LABEL } from '@/domain/constraints'
import { availableVariants, adaptToProfile, VARIANT_LABEL } from '@/domain/variants'
import { scaleRecipe } from '@/domain/scaling'
import { missingIngredients } from '@/domain/shopping'
import { formatRecipeQuantity, formatBaseQuantity } from '@/domain/units'
import { SLOT_LABEL, weekDates } from '@/domain/planner'
import { addDays } from '@/domain/shopping'
import { addMeal, addManualItem } from '@/data/actions'
import { weekListMeta } from '@/data/selectors'
import { euro, minutes, dayLabel, CONFIDENCE_LABEL } from '@/lib/format'
import { Card, Chip, Estimate, Note, PrimaryButton, SecondaryButton, Section, Sheet, Stepper, RecipeThumb } from '@/components/kit'

const DIFFICULTY = ['', 'Facile', 'Intermédiaire', 'Avancé']

function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const router = useRouter()
  const { catalog, profile, state, update, today, variantCtx } = useMijote()
  const base = catalog.recipesById.get(id)
  const [version, setVersion] = useState<VariantKind | 'originale' | null>((params.get('version') as VariantKind) ?? null)
  const [servings, setServings] = useState(() => Number(params.get('portions')) || profile?.householdSize || base?.servings || 2)
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  const [planOpen, setPlanOpen] = useState(false)
  const [added, setAdded] = useState<string | null>(null)

  const variants = useMemo(() => (base ? availableVariants(base, variantCtx) : []), [base, variantCtx])
  const check = useMemo(() => (base && profile ? checkRecipe(base, profile, catalog) : null), [base, profile, catalog])
  const autoAdapted = useMemo(() => (base && profile && check && !check.allowed ? adaptToProfile(base, profile, catalog) : null), [base, profile, catalog, check])

  if (!base) {
    return (
      <main className="max-w-2xl mx-auto px-5 pt-16 text-center">
        <p className="font-semibold">Recette introuvable</p>
        <Link href="/recettes" className="text-primary text-sm">Retour aux recettes</Link>
      </main>
    )
  }

  // Version affichee : choix explicite, sinon version adaptee automatiquement si l'originale est incompatible.
  const effectiveKind: VariantKind | null = version === 'originale' ? null : version ?? (autoAdapted?.variant?.kind ?? null)
  const versioned = effectiveKind
    ? (effectiveKind === autoAdapted?.variant?.kind ? autoAdapted : variants.find((v) => v.kind === effectiveKind)?.result.recipe) ?? base
    : base
  const recipe = scaleRecipe(versioned, servings)
  const analysis = analyzeRecipe(recipe, catalog, Number(today.slice(5, 7)))
  const versionCheck = profile ? checkRecipe(versioned, profile, catalog) : null
  const missing = missingIngredients(versioned, servings, state.pantry, catalog, today)
  const missingIds = new Set(missing.map((m) => m.ingredientId))
  const n = analysis.nutrition.value

  function addMissingToList() {
    const listId = weekListMeta(today).id
    update((s) => missing.reduce((acc, l) => addManualItem(acc, {
      listId, ingredientId: l.ingredientId, label: l.label, quantity: Math.round(l.toBuy * 100) / 100,
      unit: l.baseUnit === 'piece' ? 'piece' : l.baseUnit === 'ml' ? 'ml' : 'g', aisle: l.aisle, recurring: false, checked: false,
    }), s))
    setAdded('Ingrédients manquants ajoutés à la liste de la semaine')
  }

  function plan(date: string, slot: MealSlot) {
    update((s) => addMeal(s, date, slot, versioned, servings))
    setPlanOpen(false)
    setAdded(`Ajouté au planning : ${dayLabel(date, today)}, ${SLOT_LABEL[slot].toLowerCase()}`)
  }

  const dates = [...weekDates(today).filter((d) => d >= today), ...weekDates(addDays(today, 7))]

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-5 pt-6 pb-8">
      <button onClick={() => router.back()} className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center mb-2" aria-label="Retour"><ArrowLeft aria-hidden /></button>

      <div className="flex items-start gap-4 mb-4">
        <RecipeThumb emoji={recipe.emoji} id={base.id} size={72} />
        <div className="min-w-0">
          <h1 className="font-heading text-[1.65rem] leading-tight font-semibold">{recipe.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-5">
        <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden />{minutes(recipe.prepMinutes)} de prépa{recipe.cookMinutes > 0 && ` · ${minutes(recipe.cookMinutes)} de cuisson`}</span>
        <span className="inline-flex items-center gap-1"><Gauge size={14} aria-hidden />{DIFFICULTY[recipe.difficulty]}</span>
        <span className="inline-flex items-center gap-1"><Leaf size={14} aria-hidden />{analysis.seasonalItems === 0 ? 'Toute l’année' : analysis.seasonality >= 0.99 ? 'De saison' : 'Pas totalement de saison'}</span>
      </div>

      {check && !check.allowed && (
        <div role="alert" className="rounded-2xl border border-warning/40 bg-warning/10 p-3.5 mb-4 text-sm">
          <p className="font-semibold flex items-center gap-1.5 text-warning"><TriangleAlert size={15} aria-hidden /> Recette originale incompatible avec ton profil</p>
          <ul className="mt-1 text-foreground/80 list-disc pl-5">{check.violations.filter((v) => !v.optional).map((v, i) => <li key={i}>{v.message}</li>)}</ul>
          {autoAdapted ? <p className="mt-1.5">Une version adaptée est affichée ci-dessous.</p> : <p className="mt-1.5">Aucune adaptation fiable n’est possible pour cette recette.</p>}
        </div>
      )}

      {/* Versions */}
      {(variants.length > 0 || autoAdapted) && (
        <Section title="Versions">
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
            <Chip active={effectiveKind === null} onClick={() => setVersion('originale')}>Originale</Chip>
            {autoAdapted && autoAdapted !== base && <Chip active={effectiveKind === autoAdapted.variant?.kind} onClick={() => setVersion(autoAdapted.variant!.kind)}>{VARIANT_LABEL[autoAdapted.variant!.kind]}</Chip>}
            {variants.filter((v) => v.kind !== autoAdapted?.variant?.kind).map((v) => <Chip key={v.kind} active={effectiveKind === v.kind} onClick={() => setVersion(v.kind)}>{VARIANT_LABEL[v.kind]}</Chip>)}
          </div>
          {versioned.variant && (
            <Card className="p-3.5 mt-3">
              <p className="text-sm font-semibold flex items-center gap-1.5"><Wand2 size={15} className="text-herb" aria-hidden /> Ce qui change · fiabilité {CONFIDENCE_LABEL[versioned.variant.confidence]}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {versioned.variant.changes.map((c, i) => (
                  <li key={i} className="text-foreground/85">
                    {c.type === 'substitution' && <><strong>{catalog.ingredients.get(c.from)?.name}</strong> → <strong>{catalog.ingredients.get(c.to)?.name}</strong>. {c.note}</>}
                    {c.type !== 'substitution' && c.note}
                  </li>
                ))}
              </ul>
              {versioned.variant.warnings.map((w, i) => <p key={i} className="text-sm text-warning mt-2">{w}</p>)}
              {versionCheck && !versionCheck.allowed && <p className="text-sm text-danger mt-2">Cette version ne respecte toujours pas ton profil.</p>}
            </Card>
          )}
        </Section>
      )}

      {/* Ingredients */}
      <Section title="Ingrédients" action={<Stepper label="portions" value={servings} onChange={setServings} />}>
        <Card className="p-3.5">
          <ul className="divide-y divide-border">
            {recipe.ingredients.map((l, i) => {
              const ing = catalog.ingredients.get(l.ingredientId)!
              const isMissing = missingIds.has(l.ingredientId)
              const inStock = !isMissing && !ing.staple && l.quantity != null && state.pantry.some((p) => p.ingredientId === l.ingredientId)
              return (
                <li key={i} className="py-2 flex items-start justify-between gap-3 text-sm">
                  <span>
                    {formatRecipeQuantity(l.quantity, l.unit, ing)}
                    {l.optional && <span className="text-muted-foreground"> (facultatif)</span>}
                    {l.note && <span className="text-muted-foreground"> · {l.note}</span>}
                  </span>
                  {inStock && <span className="text-success text-xs shrink-0 inline-flex items-center gap-0.5"><Check size={12} aria-hidden />en stock</span>}
                </li>
              )
            })}
          </ul>
          {recipe.scaleWarnings.map((w, i) => <div key={i} className="mt-2"><Note>{w}</Note></div>)}
        </Card>
        {state.pantry.length > 0 && (
          <p className="text-sm mt-2.5 text-muted-foreground">
            {missing.length === 0 ? 'Tu as tout ce qu’il faut 🎉' : `Il te manque : ${missing.map((m) => `${m.label.toLowerCase()} (${formatBaseQuantity(m.toBuy, catalog.ingredients.get(m.ingredientId!)!)})`).join(', ')}.`}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <PrimaryButton onClick={() => setPlanOpen(true)}><CalendarPlus size={16} aria-hidden /> Planifier</PrimaryButton>
          <SecondaryButton onClick={addMissingToList} disabled={missing.length === 0}><ShoppingBasket size={16} aria-hidden /> {state.pantry.length > 0 ? 'Ajouter les manquants' : 'Ajouter aux courses'}</SecondaryButton>
        </div>
        {added && <p role="status" className="text-sm text-success mt-2">{added}</p>}
      </Section>

      {/* Etapes */}
      <Section title="Préparation">
        <ol className="space-y-2">
          {recipe.steps.map((s, i) => {
            const done = doneSteps.has(i)
            return (
              <li key={i}>
                <button
                  onClick={() => setDoneSteps((cur) => { const n2 = new Set(cur); if (n2.has(i)) n2.delete(i); else n2.add(i); return n2 })}
                  aria-pressed={done}
                  className={`w-full text-left flex gap-3 rounded-2xl border p-3.5 transition-colors ${done ? 'bg-muted/60 border-transparent text-muted-foreground' : 'bg-card border-border'}`}
                >
                  <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-success text-primary-foreground' : 'bg-primary/10 text-primary'}`}>{done ? <Check size={14} aria-hidden /> : i + 1}</span>
                  <span className={`text-[0.95rem] leading-relaxed ${done ? 'line-through' : ''}`}>{s}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </Section>

      {/* Estimations */}
      <Section title="Repères">
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3.5">
            <p className="text-xs text-muted-foreground">Coût</p>
            <p className="font-bold mt-0.5"><Estimate confidence={analysis.cost.confidence}>{euro(analysis.cost.value)}</Estimate></p>
            <p className="text-xs text-muted-foreground"><Estimate confidence={analysis.costPerServing.confidence}>{euro(analysis.costPerServing.value)}</Estimate> par portion</p>
          </Card>
          <Card className="p-3.5">
            <p className="text-xs text-muted-foreground">Énergie par portion</p>
            <p className="font-bold mt-0.5"><Estimate confidence={analysis.nutrition.confidence}>{n.kcal} kcal</Estimate></p>
            <p className="text-xs text-muted-foreground">P {Math.round(n.protein)} g · G {Math.round(n.carbs)} g · L {Math.round(n.fat)} g · fibres {Math.round(n.fiber)} g</p>
          </Card>
        </div>
        <div className="mt-2"><Note>Prix moyens et valeurs nutritionnelles estimés à partir des ingrédients (ordres de grandeur type CIQUAL, prix moyens en grande surface). Ce ne sont pas des valeurs mesurées.</Note></div>

        <Card className="p-3.5 mt-3 text-sm space-y-2">
          <p><span className="text-muted-foreground">Allergènes : </span>{analysis.allergens.length ? analysis.allergens.map((a) => ALLERGEN_LABEL[a]).join(', ') : 'aucun des 14 allergènes majeurs dans les ingrédients'}
            {analysis.optionalAllergens.length > 0 && <span className="text-muted-foreground"> (facultatif : {analysis.optionalAllergens.map((a) => ALLERGEN_LABEL[a].toLowerCase()).join(', ')})</span>}
          </p>
          <p><span className="text-muted-foreground">Convient aux régimes : </span>{analysis.diets.filter((d) => d !== 'omnivore' && d !== 'flexitarien').map((d) => ({ pescetarien: 'pescétarien', vegetarien: 'végétarien', vegetalien: 'végétalien' } as Record<string, string>)[d]).join(', ') || 'omnivore'}</p>
          <p className="flex items-center gap-1.5"><Refrigerator size={14} className="text-muted-foreground" aria-hidden />{recipe.storage.fridgeDays > 0 ? `Se garde ${recipe.storage.fridgeDays} jour${recipe.storage.fridgeDays > 1 ? 's' : ''} au frigo` : 'À déguster tout de suite'}
            {recipe.storage.freezable && <><span aria-hidden>·</span><Snowflake size={14} className="text-muted-foreground" aria-hidden />se congèle</>}
          </p>
          <p className="flex items-center gap-1.5"><Users size={14} className="text-muted-foreground" aria-hidden />Recette de base pour {base.servings} personnes</p>
          <Note>Allergies : vérifie toujours les étiquettes, la composition varie selon les marques.</Note>
        </Card>
      </Section>

      <Sheet open={planOpen} onOpenChange={setPlanOpen} title="Planifier ce repas" description={`${recipe.name} · ${servings} portions`}>
        <div className="space-y-3">
          {dates.map((d) => (
            <div key={d}>
              <p className="text-sm font-semibold capitalize mb-1.5">{dayLabel(d, today)}</p>
              <div className="flex gap-2 flex-wrap">
                {(profile?.slots ?? ['dejeuner', 'diner']).filter((s) => base.slots.includes(s)).map((slot) => {
                  const occupied = state.plan.find((e) => e.date === d && e.slot === slot)
                  const occName = occupied?.recipeId ? catalog.recipesById.get(occupied.recipeId)?.name : occupied ? 'Extérieur' : null
                  return (
                    <button key={slot} onClick={() => plan(d, slot)} className="px-3 min-h-10 rounded-xl border border-border bg-card text-sm text-left">
                      {SLOT_LABEL[slot]}{occName && <span className="block text-[11px] text-muted-foreground truncate max-w-40">remplace : {occName}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </main>
  )
}

export default function RecipePage() {
  return <Suspense><RecipeDetail /></Suspense>
}
