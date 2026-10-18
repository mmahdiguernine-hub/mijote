'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import type { Allergen, Diet, Goal, Profile } from '@/domain/types'
import { ALLERGEN_LABEL } from '@/domain/constraints'
import { useMijote } from '@/data/mijote-provider'
import { DEFAULT_PROFILE } from '@/data/state'
import { setProfile } from '@/data/actions'
import { ALLERGEN_OPTIONS, DIET_OPTIONS, GOAL_OPTIONS } from '@/lib/labels'
import { Chip, PrimaryButton, Stepper, Note } from '@/components/kit'
import { IngredientPicker } from '@/components/ingredient-picker'

// Inscription progressive (meme principe que le tunnel d'onboarding de PeakMind : une question a la
// fois). Trois ecrans seulement ; tout le reste (equipement, budget, gouts detailles...) a des
// valeurs par defaut raisonnables et se regle plus tard dans le profil.

const STEPS = 3

export default function Bienvenue() {
  const { state, update, catalog } = useMijote()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [p, setP] = useState<Profile>(() => ({ ...DEFAULT_PROFILE, ...state.profile }))
  const patch = (x: Partial<Profile>) => setP((cur) => ({ ...cur, ...x }))

  const toggleAllergen = (a: Allergen) => patch({ allergens: p.allergens.includes(a) ? p.allergens.filter((x) => x !== a) : [...p.allergens, a] })
  const toggleGoal = (g: Goal) => patch({ goals: p.goals.some((x) => x.goal === g) ? p.goals.filter((x) => x.goal !== g) : [...p.goals, { goal: g, intensity: 'modere' }] })

  function finish() {
    update((s) => setProfile(s, { ...p, onboardingDone: true }))
    router.replace('/')
  }

  return (
    <main className="max-w-xl mx-auto px-5 pt-8 pb-10 min-h-dvh flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center" aria-label="Étape précédente"><ChevronLeft aria-hidden /></button>
        ) : <span className="w-8" />}
        <div className="flex-1 flex gap-1.5" aria-label={`Étape ${step + 1} sur ${STEPS}`}>
          {Array.from({ length: STEPS }).map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />)}
        </div>
      </div>

      {step === 0 && (
        <section className="flex-1">
          <p className="text-4xl mb-3" aria-hidden>🍲</p>
          <h1 className="font-heading text-3xl font-semibold leading-tight">Bienvenue sur Mijote</h1>
          <p className="text-muted-foreground mt-2">Trois questions pour commencer. Tu pourras tout changer à tout moment.</p>

          <h2 className="font-semibold mt-8 mb-2">Combien de personnes à table ?</h2>
          <Stepper label="personnes" value={p.householdSize} onChange={(v) => patch({ householdSize: v })} max={12} />

          <h2 className="font-semibold mt-8 mb-2">Comment manges-tu ?</h2>
          <div className="grid gap-2" role="radiogroup" aria-label="Régime alimentaire">
            {DIET_OPTIONS.map((d) => (
              <button key={d.value} role="radio" aria-checked={p.diet === d.value} onClick={() => patch({ diet: d.value as Diet })}
                className={`text-left rounded-2xl border p-3.5 transition-colors ${p.diet === d.value ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
                <span className="font-semibold block">{d.label}</span>
                <span className="text-xs text-muted-foreground">{d.hint}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex-1">
          <h1 className="font-heading text-3xl font-semibold leading-tight">Allergies et aliments à éviter</h1>
          <p className="text-muted-foreground mt-2">Ce sont des règles strictes : ces aliments n’apparaîtront jamais dans tes menus.</p>
          <h2 className="font-semibold mt-6 mb-2">Allergies ou intolérances</h2>
          <div className="flex flex-wrap gap-2">
            {ALLERGEN_OPTIONS.map((a) => <Chip key={a} active={p.allergens.includes(a)} onClick={() => toggleAllergen(a)}>{ALLERGEN_LABEL[a]}</Chip>)}
          </div>
          <h2 className="font-semibold mt-6 mb-2">Ingrédients que tu ne veux jamais voir</h2>
          <IngredientPicker catalog={catalog} selected={p.excludedIngredients} onChange={(ids) => patch({ excludedIngredients: ids })} placeholder="Ex. coriandre, champignons…" />
          <div className="mt-4"><Note>Pense à toujours vérifier les étiquettes : la composition des produits varie selon les marques.</Note></div>
        </section>
      )}

      {step === 2 && (
        <section className="flex-1">
          <h1 className="font-heading text-3xl font-semibold leading-tight">Qu’est-ce qui compte pour toi ?</h1>
          <p className="text-muted-foreground mt-2">Choisis autant d’envies que tu veux, ou aucune. Rien n’est imposé.</p>
          <div className="flex flex-wrap gap-2 mt-6">
            {GOAL_OPTIONS.slice(0, 10).map((g) => <Chip key={g.value} active={p.goals.some((x) => x.goal === g.value)} onClick={() => toggleGoal(g.value)}>{g.label}</Chip>)}
          </div>
          <h2 className="font-semibold mt-8 mb-2">Temps pour cuisiner en semaine</h2>
          <div className="flex flex-wrap gap-2">
            {[20, 30, 45, 60].map((m) => <Chip key={m} active={p.maxMinutesWeekday === m} onClick={() => patch({ maxMinutesWeekday: m })}>{m === 60 ? '1 h et plus' : `${m} min`}</Chip>)}
          </div>
        </section>
      )}

      <div className="pt-8">
        {step < STEPS - 1 ? (
          <PrimaryButton className="w-full" onClick={() => setStep(step + 1)}>Continuer <ArrowRight size={16} aria-hidden /></PrimaryButton>
        ) : (
          <PrimaryButton className="w-full" onClick={finish}>C’est parti</PrimaryButton>
        )}
        {step > 0 && step < STEPS - 1 && <button className="w-full mt-3 text-sm text-muted-foreground min-h-11" onClick={() => setStep(step + 1)}>Passer</button>}
      </div>
    </main>
  )
}
