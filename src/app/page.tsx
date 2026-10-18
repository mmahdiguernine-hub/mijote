'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Activity, CalendarPlus, ChevronRight, Clock, ShoppingBasket, TriangleAlert, Utensils } from 'lucide-react'
import { useMijote } from '@/data/mijote-provider'
import { suggestRecipes } from '@/domain/scoring'
import { expiringSoon } from '@/domain/pantry'
import { dayNutrition, DAY_TYPE_LABEL, SESSION_LABEL } from '@/domain/sport'
import { SLOT_LABEL, SLOT_ORDER, weekDates } from '@/domain/planner'
import { resolveRecipe } from '@/domain/variants'
import { computeList, weekListMeta } from '@/data/selectors'
import { dayLabel, euro, minutes } from '@/lib/format'
import { Page, PageHeader, Section, Card, Estimate, EmptyState } from '@/components/kit'
import { RecipeCard } from '@/components/recipe-card'

function greeting(): string {
  const h = new Date().getHours()
  return h < 11 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

export default function Accueil() {
  const { state, catalog, today, profile, scoreCtx, variantCtx } = useMijote()

  // Prochain repas : premier repas du planning a partir de maintenant, non cuisine.
  const nextMeal = useMemo(() => {
    const hour = new Date().getHours()
    const passedSlots = hour >= 21 ? 4 : hour >= 14 ? 2 : hour >= 10 ? 1 : 0
    return state.plan
      .filter((e) => e.kind !== 'exterieur' && !e.cookedAt && (e.date > today || (e.date === today && SLOT_ORDER.indexOf(e.slot) >= passedSlots)))
      .sort((a, b) => (a.date + SLOT_ORDER.indexOf(a.slot)).localeCompare(b.date + SLOT_ORDER.indexOf(b.slot)))[0]
  }, [state.plan, today])

  const nextRecipe = nextMeal?.recipeId ? catalog.recipesById.get(nextMeal.recipeId) : undefined
  const nextResolved = nextRecipe ? resolveRecipe(nextRecipe, nextMeal?.variant, variantCtx) : undefined
  const expiring = expiringSoon(state.pantry, today, 3)
  const suggestions = useMemo(() => (scoreCtx ? suggestRecipes(scoreCtx, { slot: 'diner', limit: 4 }) : []), [scoreCtx])
  const week = weekDates(today)
  const plannedThisWeek = state.plan.filter((e) => e.date >= week[0] && e.date <= week[6] && e.kind === 'recette').length
  const slotsThisWeek = (profile?.slots.length ?? 2) * 7
  const list = useMemo(() => computeList(state, catalog, weekListMeta(today), today), [state, catalog, today])
  const toBuy = list.byAisle.reduce((n, g) => n + g.lines.filter((l) => !l.checked).length, 0)

  return (
    <Page>
      <PageHeader eyebrow={dayLabel(today)} title={`${greeting()}${profile?.displayName ? `, ${profile.displayName}` : ''}`} />

      {/* Prochain repas */}
      {nextMeal && nextResolved ? (
        <Link href={`/recettes/${nextRecipe!.id}?portions=${nextMeal.servings}${nextMeal.variant ? `&version=${nextMeal.variant}` : ''}`} className="block rounded-2xl p-5 mb-6 shadow-soft" style={{ background: 'var(--hero-gradient)', color: 'var(--hero-ink)' }}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--hero-ink-faint)' }}>
            {nextMeal.kind === 'reste' ? 'Reste prévu' : 'Prochain repas'} · {dayLabel(nextMeal.date, today)} · {SLOT_LABEL[nextMeal.slot]}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-5xl" aria-hidden>{nextResolved.emoji}</span>
            <div className="min-w-0">
              <p className="font-heading text-2xl font-semibold leading-tight">{nextResolved.name}</p>
              <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: 'var(--hero-ink-soft)' }}>
                <Clock size={14} aria-hidden />
                {nextMeal.kind === 'reste' ? 'À réchauffer' : minutes(nextResolved.prepMinutes + nextResolved.cookMinutes)} · {nextMeal.servings} pers.
              </p>
            </div>
          </div>
        </Link>
      ) : (
        <div className="mb-6">
          <EmptyState
            icon={<CalendarPlus size={22} />}
            title="Aucun repas prévu"
            text="Laisse Mijote préparer ta semaine selon tes goûts, ou choisis tes recettes une à une."
            action={<Link href="/planning" className="inline-flex px-4 min-h-11 items-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Planifier ma semaine</Link>}
          />
        </div>
      )}

      {/* Sport du jour */}
      {profile?.sport?.enabled && profile.sport.weightKg && (() => {
        const nut = dayNutrition(profile.sport!, today, state.training, state.races)
        const race = state.races.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
        const daysToRace = race ? Math.round((Date.parse(race.date) - Date.parse(today)) / 86400000) : null
        if (!nut) return null
        return (
          <Link href="/sport" className="flex items-center justify-between gap-3 rounded-2xl bg-card border border-border p-4 mb-6">
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Activity size={18} aria-hidden /></span>
              <span className="min-w-0">
                <span className="font-semibold block">{DAY_TYPE_LABEL[nut.dayType]}{nut.sessions.length > 0 ? ` · ${nut.sessions.map((s) => SESSION_LABEL[s.kind].toLowerCase()).join(' + ')}` : ''}</span>
                <span className="text-xs text-muted-foreground block">Glucides {nut.carbs.min}–{nut.carbs.max} g · protéines {nut.protein.min}–{nut.protein.max} g{daysToRace != null && daysToRace <= 14 ? ` · ${race!.name} dans ${daysToRace} j` : ''}</span>
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0" aria-hidden />
          </Link>
        )
      })()}

      {/* Produits a utiliser */}
      {expiring.length > 0 && (
        <Section title="À utiliser vite" action={<Link href="/recettes?q=avec%20mes%20restes" className="text-sm text-primary font-semibold">Idées</Link>}>
          <Card className="p-3">
            <ul className="divide-y divide-border">
              {expiring.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2"><TriangleAlert size={14} className="text-warning" aria-hidden />{catalog.ingredients.get(p.ingredientId)?.name}</span>
                  <span className="text-muted-foreground">{dayLabel(p.expiresOn!, today, 'short')}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      {/* Semaine + courses */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/planning" className="rounded-2xl bg-card border border-border p-4">
          <Utensils size={18} className="text-primary" aria-hidden />
          <p className="text-xl font-bold mt-2 tabular-nums">{plannedThisWeek}<span className="text-sm font-medium text-muted-foreground">/{slotsThisWeek}</span></p>
          <p className="text-xs text-muted-foreground">repas planifiés cette semaine</p>
        </Link>
        <Link href="/courses" className="rounded-2xl bg-card border border-border p-4">
          <ShoppingBasket size={18} className="text-primary" aria-hidden />
          <p className="text-xl font-bold mt-2 tabular-nums">{toBuy}</p>
          <p className="text-xs text-muted-foreground">
            {toBuy === 0 ? 'rien à acheter' : <>articles · <Estimate confidence={list.cost.pricedLines === list.cost.totalLines ? 'moyenne' : 'faible'}>{euro(list.cost.value)}</Estimate></>}
          </p>
        </Link>
      </div>

      {/* Mini planning */}
      <Section title="Cette semaine" action={<Link href="/planning" className="text-sm text-primary font-semibold flex items-center">Planning <ChevronRight size={16} aria-hidden /></Link>}>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {week.map((d) => {
            const meals = state.plan.filter((e) => e.date === d).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
            return (
              <Link key={d} href={`/planning#${d}`} className={`shrink-0 w-24 rounded-2xl border p-2.5 ${d === today ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                <p className="text-xs font-semibold capitalize">{dayLabel(d, today, 'short')}</p>
                <div className="flex gap-1 mt-2 min-h-7">
                  {meals.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : meals.map((m) => {
                    const r = m.recipeId ? catalog.recipesById.get(m.recipeId) : undefined
                    return <span key={m.id} className="text-xl" title={r?.name ?? 'Extérieur'} aria-label={r?.name ?? 'Repas à l’extérieur'}>{m.kind === 'exterieur' ? '🚶' : r?.emoji}</span>
                  })}
                </div>
              </Link>
            )
          })}
        </div>
      </Section>

      {/* Suggestions */}
      <Section title="Pour ce soir" action={<Link href="/recettes" className="text-sm text-primary font-semibold flex items-center">Tout voir <ChevronRight size={16} aria-hidden /></Link>}>
        <div className="grid gap-2">
          {suggestions.map((s) => <RecipeCard key={s.recipe.id} item={s} />)}
        </div>
      </Section>

    </Page>
  )
}
