'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Download, LogOut } from 'lucide-react'
import type { Allergen, Difficulty, Equipment, Goal, GoalIntensity, MealSlot, Profile } from '@/domain/types'
import { ALLERGEN_LABEL, EQUIPMENT_LABEL } from '@/domain/constraints'
import { useMijote } from '@/data/mijote-provider'
import { setProfile } from '@/data/actions'
import { DEFAULT_PROFILE } from '@/data/state'
import { ALLERGEN_OPTIONS, DIET_OPTIONS, GOAL_OPTIONS, INTENSITY_LABEL, SLOT_OPTIONS } from '@/lib/labels'
import { Page, PageHeader, Section, Card, Chip, Stepper, Note, SecondaryButton } from '@/components/kit'
import { IngredientPicker } from '@/components/ingredient-picker'

const PALETTES = [
  { id: 'terracotta', label: 'Terracotta', colors: ['#F6F0E7', '#A9472A', '#4F6B3A'] },
  { id: 'sauge', label: 'Sauge', colors: ['#EEF1E8', '#46663F', '#B5761F'] },
  { id: 'safran', label: 'Safran', colors: ['#F7F1EA', '#6B3466', '#A8670B'] },
]

function usePalette(): [string, (p: string) => void] {
  const [palette, setPaletteState] = useState(() => {
    try { return localStorage.getItem('mijote:palette') ?? 'terracotta' } catch { return 'terracotta' }
  })
  return [palette, (p: string) => {
    setPaletteState(p)
    if (p === 'terracotta') document.documentElement.removeAttribute('data-palette')
    else document.documentElement.setAttribute('data-palette', p)
    try { localStorage.setItem('mijote:palette', p) } catch { /* idem */ }
  }]
}

export default function ProfilPage() {
  const { profile, update, catalog, mode, state } = useMijote()
  const { theme, setTheme } = useTheme()
  const [palette, setPalette] = usePalette()
  const p = profile ?? DEFAULT_PROFILE
  const patch = (x: Partial<Profile>) => update((s) => setProfile(s, { ...p, ...x }))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const goalOf = (g: Goal) => p.goals.find((x) => x.goal === g)
  const setGoal = (g: Goal, intensity: GoalIntensity | null) =>
    patch({ goals: intensity ? [...p.goals.filter((x) => x.goal !== g), { goal: g, intensity }] : p.goals.filter((x) => x.goal !== g) })

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'mijote-export.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Page>
      <PageHeader eyebrow="Profil et préférences" title="À ta façon" profileLink={false} />
      <p className="text-sm text-muted-foreground -mt-3 mb-6">Chaque réglage est enregistré tout de suite et influence les suggestions, le planning et les courses.</p>

      <Section title="Foyer et repas">
        <Card className="p-4 space-y-4">
          <label className="block text-sm font-medium">Prénom (facultatif)
            <input value={p.displayName ?? ''} onChange={(e) => patch({ displayName: e.target.value || undefined })} className="w-full min-h-11 rounded-xl border border-border bg-background px-3 text-base mt-1" />
          </label>
          <div className="flex items-center justify-between"><span className="text-sm font-medium">Personnes à table</span><Stepper label="personnes" value={p.householdSize} onChange={(v) => patch({ householdSize: v })} max={12} /></div>
          <div>
            <p className="text-sm font-medium mb-2">Repas à planifier</p>
            <div className="flex flex-wrap gap-2">{SLOT_OPTIONS.map((s) => <Chip key={s.value} active={p.slots.includes(s.value)} onClick={() => { const next = toggle(p.slots, s.value as MealSlot); if (next.length) patch({ slots: next }) }}>{s.label}</Chip>)}</div>
          </div>
        </Card>
      </Section>

      <Section title="Régime et contraintes strictes">
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">{DIET_OPTIONS.map((d) => <Chip key={d.value} active={p.diet === d.value} onClick={() => patch({ diet: d.value })}>{d.label}</Chip>)}</div>
          <div>
            <p className="text-sm font-medium mb-2">Allergies et intolérances</p>
            <div className="flex flex-wrap gap-2">{ALLERGEN_OPTIONS.map((a) => <Chip key={a} active={p.allergens.includes(a)} onClick={() => patch({ allergens: toggle<Allergen>(p.allergens, a) })}>{ALLERGEN_LABEL[a]}</Chip>)}</div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Ingrédients exclus</p>
            <IngredientPicker catalog={catalog} selected={p.excludedIngredients} onChange={(ids) => patch({ excludedIngredients: ids })} />
          </div>
          <Note>Ces règles ne sont jamais assouplies : une recette concernée n’est proposée que dans une version adaptée, ou pas du tout.</Note>
        </Card>
      </Section>

      <Section title="Goûts">
        <Card className="p-4 space-y-4">
          <div><p className="text-sm font-medium mb-2">J’adore</p><IngredientPicker catalog={catalog} selected={p.likedIngredients} onChange={(ids) => patch({ likedIngredients: ids })} placeholder="Ex. champignons, saumon…" /></div>
          <div><p className="text-sm font-medium mb-2">Je préfère éviter</p><IngredientPicker catalog={catalog} selected={p.dislikedIngredients} onChange={(ids) => patch({ dislikedIngredients: ids })} placeholder="Ex. aubergine…" /></div>
          <Note>Contrairement aux exclusions, ce sont des préférences : elles changent l’ordre des suggestions sans rien interdire.</Note>
          <label className="block text-sm font-medium">Envie de découverte
            <input type="range" min={0} max={1} step={0.1} value={p.discovery} onChange={(e) => patch({ discovery: Number(e.target.value) })} className="w-full mt-2 accent-[var(--primary)]" aria-valuetext={p.discovery < 0.34 ? 'Valeurs sûres' : p.discovery < 0.67 ? 'Équilibré' : 'Surprends-moi'} />
            <span className="flex justify-between text-xs text-muted-foreground"><span>Valeurs sûres</span><span>Surprends-moi</span></span>
          </label>
          <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={p.preferSeasonal} onChange={(e) => patch({ preferSeasonal: e.target.checked })} className="w-5 h-5 accent-[var(--primary)]" />Privilégier les produits de saison</label>
        </Card>
      </Section>

      <Section title="Objectifs">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-3">Aucun n’est obligatoire. Choisis pour chacun l’approche qui te convient.</p>
          <ul className="space-y-2.5">
            {GOAL_OPTIONS.map((g) => {
              const cur = goalOf(g.value)
              return (
                <li key={g.value} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm">{g.label}</span>
                  <div className="flex gap-1" role="radiogroup" aria-label={g.label}>
                    <Chip active={!cur} onClick={() => setGoal(g.value, null)} className="!min-h-8 text-xs">Non</Chip>
                    {(['souple', 'modere', 'strict'] as GoalIntensity[]).map((i) => <Chip key={i} active={cur?.intensity === i} onClick={() => setGoal(g.value, i)} className="!min-h-8 text-xs">{INTENSITY_LABEL[i]}</Chip>)}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </Section>

      <Section title="Au quotidien">
        <Card className="p-4 space-y-4">
          <div><p className="text-sm font-medium mb-2">Temps pour cuisiner en semaine</p>
            <div className="flex flex-wrap gap-2">{[15, 20, 30, 45, 60].map((m) => <Chip key={m} active={p.maxMinutesWeekday === m} onClick={() => patch({ maxMinutesWeekday: m })}>{m} min</Chip>)}</div></div>
          <div><p className="text-sm font-medium mb-2">Le week-end</p>
            <div className="flex flex-wrap gap-2">{[30, 60, 90, 180].map((m) => <Chip key={m} active={p.maxMinutesWeekend === m} onClick={() => patch({ maxMinutesWeekend: m })}>{m >= 60 ? `${m / 60} h` : `${m} min`}</Chip>)}</div></div>
          <div><p className="text-sm font-medium mb-2">Niveau en cuisine</p>
            <div className="flex gap-2">{(['Débutant', 'À l’aise', 'Confirmé'] as const).map((l, i) => <Chip key={l} active={p.skill === i + 1} onClick={() => patch({ skill: (i + 1) as Difficulty })}>{l}</Chip>)}</div></div>
          <div><p className="text-sm font-medium mb-2">Équipement</p>
            <div className="flex flex-wrap gap-2">{(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => <Chip key={e} active={p.equipment.includes(e)} onClick={() => patch({ equipment: toggle(p.equipment, e) })}>{EQUIPMENT_LABEL[e]}</Chip>)}</div></div>
          <div><p className="text-sm font-medium mb-2">Budget courses (facultatif)</p>
            <div className="flex gap-2">
              <input inputMode="decimal" value={p.budget?.amount ?? ''} placeholder="Montant en €" aria-label="Budget en euros"
                onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); patch({ budget: e.target.value && Number.isFinite(v) && v > 0 ? { amount: v, period: p.budget?.period ?? 'semaine' } : undefined }) }}
                className="flex-1 min-h-11 rounded-xl border border-border bg-background px-3 text-base" />
              <select value={p.budget?.period ?? 'semaine'} onChange={(e) => p.budget && patch({ budget: { ...p.budget, period: e.target.value as 'semaine' | 'mois' } })} aria-label="Période du budget" className="min-h-11 rounded-xl border border-border bg-background px-2 text-base">
                <option value="semaine">par semaine</option><option value="mois">par mois</option>
              </select>
            </div></div>
          <div><p className="text-sm font-medium mb-2">Organisation</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={p.cookingStyle === 'chaque_jour'} onClick={() => patch({ cookingStyle: 'chaque_jour' })}>Je cuisine chaque jour</Chip>
              <Chip active={p.cookingStyle === 'mixte'} onClick={() => patch({ cookingStyle: 'mixte' })}>Un peu des deux</Chip>
              <Chip active={p.cookingStyle === 'batch'} onClick={() => patch({ cookingStyle: 'batch' })}>Je prépare à l’avance</Chip>
            </div></div>
          <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={p.leftoversOk} onChange={(e) => patch({ leftoversOk: e.target.checked })} className="w-5 h-5 accent-[var(--primary)]" />Les restes du dîner me vont pour le déjeuner du lendemain</label>
        </Card>
      </Section>

      <Section title="Apparence">
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Palette de couleurs">
            {PALETTES.map((pal) => (
              <button key={pal.id} role="radio" aria-checked={palette === pal.id} onClick={() => setPalette(pal.id)} className={`rounded-xl border p-2.5 text-sm ${palette === pal.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
                <span className="flex gap-1 justify-center mb-1.5" aria-hidden>{pal.colors.map((c) => <span key={c} className="w-5 h-5 rounded-full border border-black/10" style={{ background: c }} />)}</span>
                {pal.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[['light', 'Clair'], ['dark', 'Sombre'], ['system', 'Auto']].map(([v, l]) => <Chip key={v} active={theme === v} onClick={() => setTheme(v)}>{l}</Chip>)}
          </div>
        </Card>
      </Section>

      <Section title="Mes données">
        <Card className="p-4 space-y-3">
          <p className="text-sm">{mode === 'local' ? 'Mode local : tes données restent sur cet appareil (aucun compte, aucune synchronisation).' : 'Compte connecté : tes données sont synchronisées entre tes appareils.'}</p>
          <SecondaryButton className="w-full" onClick={exportData}><Download size={16} aria-hidden /> Exporter mes données (JSON)</SecondaryButton>
          {mode === 'cloud' && (
            <form action="/api/auth/signout" method="post"><SecondaryButton className="w-full" type="submit"><LogOut size={16} aria-hidden /> Se déconnecter</SecondaryButton></form>
          )}
        </Card>
      </Section>
    </Page>
  )
}
