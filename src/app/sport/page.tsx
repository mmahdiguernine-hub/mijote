'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, Flag, Plus, RefreshCw, Timer, Trash2, Dumbbell, Footprints, ChevronRight, Droplets } from 'lucide-react'
import type { SessionKind, TimeOfDay, TrainingSession } from '@/domain/types'
import { useMijote } from '@/data/mijote-provider'
import { dayNutrition, DAY_TYPE_LABEL, SESSION_LABEL, type Range } from '@/domain/sport'
import { buildRacePlan } from '@/domain/race-plan'
import { weekDates } from '@/domain/planner'
import { addDays } from '@/domain/shopping'
import { plannedIntake } from '@/data/selectors'
import { applyPeakmindSync, removeRace, removeSession, setProfile, upsertRace, upsertSession, generateDays } from '@/data/actions'
import { DEFAULT_PROFILE, DEFAULT_SPORT, newId, type StoredRace } from '@/data/state'
import { syncFromPeakmind } from '@/lib/peakmind'
import { dayLabel, minutes } from '@/lib/format'
import { Page, PageHeader, Section, Card, Chip, Note, PrimaryButton, SecondaryButton, Sheet, RecipeThumb } from '@/components/kit'


export default function SportPage() {
  const { state, update, catalog, today, profile } = useMijote()
  const sport = profile?.sport
  const [sessionSheet, setSessionSheet] = useState<TrainingSession | 'new' | null>(null)
  const [raceSheet, setRaceSheet] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const races = useMemo(() => state.races.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date)), [state.races, today])
  const nextRace = races[0]
  const week = weekDates(today)
  const todayNut = sport?.enabled ? dayNutrition(sport, today, state.training, state.races) : null
  const intake = useMemo(() => plannedIntake(state, catalog, today), [state, catalog, today])
  const racePlan = useMemo(() => {
    if (!sport?.enabled || !profile || !nextRace) return null
    const days = Math.round((Date.parse(nextRace.date) - Date.parse(today)) / 86400000)
    return days <= 21 ? buildRacePlan({ profile, sport, race: nextRace, sessions: state.training, catalog, today }) : null
  }, [sport, profile, nextRace, state.training, catalog, today])

  if (!sport?.enabled || !sport.weightKg) return <SportSetup />

  async function sync() {
    if (!sport?.peakmind) return
    setSyncing(true)
    setMessage(null)
    try {
      const r = await syncFromPeakmind(sport.peakmind, sport.defaultTimeOfDay)
      update((s) => applyPeakmindSync(s, r.sessions, r.races, new Date().toISOString()))
      setMessage(`${r.sessions.length} séance${r.sessions.length > 1 ? 's' : ''} et ${r.races.length} course${r.races.length > 1 ? 's' : ''} récupérées depuis PeakMind.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Synchronisation impossible')
    } finally {
      setSyncing(false)
    }
  }

  function planRaceWeek() {
    if (!racePlan) return
    const dates = racePlan.days.map((d) => d.date).filter((d) => d >= today)
    update((s) => generateDays(s, catalog, dates, { keepExisting: true, today }).state)
    setMessage('Repas de la semaine de course ajoutés au planning (les repas déjà prévus sont gardés).')
  }

  return (
    <Page>
      <PageHeader eyebrow="Nutrition sportive" title="Sport"
        action={sport.peakmind ? <button onClick={sync} disabled={syncing} className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center disabled:opacity-50" aria-label="Synchroniser avec PeakMind"><RefreshCw size={18} className={syncing ? 'animate-spin' : ''} aria-hidden /></button> : undefined} />
      {message && <p role="status" className="text-sm mb-4 rounded-xl bg-muted px-3 py-2">{message}</p>}

      {/* Aujourd'hui */}
      {todayNut && (
        <div className="rounded-2xl p-5 mb-6 shadow-soft" style={{ background: 'var(--hero-gradient)', color: 'var(--hero-ink)' }}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--hero-ink-faint)' }}>Aujourd’hui · {DAY_TYPE_LABEL[todayNut.dayType]}</p>
          {todayNut.sessions.length > 0 && <p className="font-heading text-xl font-semibold mt-1">{todayNut.sessions.map((s) => `${SESSION_LABEL[s.kind]} ${minutes(s.durationMinutes)}`).join(' + ')}</p>}
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <Target label="Énergie" range={todayNut.energy} unit="kcal" planned={intake.meals ? intake.kcal : null} />
            <Target label="Glucides" range={todayNut.carbs} unit="g" planned={intake.meals ? intake.carbs : null} />
            <Target label="Protéines" range={todayNut.protein} unit="g" planned={intake.meals ? intake.protein : null} />
            <Target label="Lipides" range={todayNut.fat} unit="g" planned={intake.meals ? intake.fat : null} />
          </div>
          {todayNut.during && <p className="text-sm mt-3 flex items-center gap-1.5" style={{ color: 'var(--hero-ink-soft)' }}><Droplets size={14} aria-hidden />Pendant l’effort : {todayNut.during.min}–{todayNut.during.max} g de glucides par heure</p>}
        </div>
      )}
      {todayNut && (
        <Section>
          <ul className="space-y-2 text-sm">{todayNut.tips.map((t, i) => <li key={i} className="rounded-xl bg-card border border-border p-3">{t}</li>)}</ul>
          {intake.meals > 0 && intake.carbs < todayNut.carbs.min * 0.8 && (
            <p className="text-sm mt-2 text-warning">Tes repas prévus apportent environ {intake.carbs} g de glucides (1 portion chacun) : ajoute une collation ou une portion de féculents en plus.</p>
          )}
          {todayNut.warnings.map((w, i) => <p key={i} className="text-sm text-warning mt-2">{w}</p>)}
          <div className="mt-3"><Note>Repères estimés (consensus CIO/ACSM/ISSN) à partir de ton poids et de tes séances, pas une prescription médicale. Les apports « prévus » comptent une portion par repas planifié.</Note></div>
        </Section>
      )}

      {/* Semaine */}
      <Section title="Mes séances" action={<button onClick={() => setSessionSheet('new')} className="text-sm text-primary font-semibold min-h-10 inline-flex items-center gap-1"><Plus size={16} aria-hidden /> Ajouter</button>}>
        <div className="space-y-2">
          {[...week, ...weekDates(addDays(today, 7))].filter((d) => d >= today).slice(0, 8).map((d) => {
            const sessions = state.training.filter((s) => s.date === d)
            const nut = dayNutrition(sport, d, state.training, state.races)
            return (
              <Card key={d} className="p-3 flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-semibold capitalize">{dayLabel(d, today, 'short')}</p>
                  {nut && <p className="text-[11px] text-muted-foreground">{DAY_TYPE_LABEL[nut.dayType]}</p>}
                </div>
                <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                  {sessions.length === 0 && <span className="text-xs text-muted-foreground">Repos</span>}
                  {sessions.map((s) => (
                    <button key={s.id} onClick={() => setSessionSheet(s)} className="text-xs px-2.5 min-h-8 rounded-full bg-primary/10 text-primary font-medium inline-flex items-center gap-1">
                      {s.sport === 'renfo' ? <Dumbbell size={12} aria-hidden /> : <Footprints size={12} aria-hidden />}
                      {SESSION_LABEL[s.kind]} {minutes(s.durationMinutes)}{s.source === 'peakmind' ? ' · PM' : ''}
                    </button>
                  ))}
                </div>
                {nut && <p className="text-[11px] text-muted-foreground text-right shrink-0">{nut.carbs.min}–{nut.carbs.max} g<br />glucides</p>}
              </Card>
            )
          })}
        </div>
        {!sport.peakmind && <div className="mt-2"><Note>Relie PeakMind dans le profil pour récupérer automatiquement ton plan d’entraînement.</Note></div>}
      </Section>

      {/* Courses */}
      <Section title="Courses objectif" action={<button onClick={() => setRaceSheet(true)} className="text-sm text-primary font-semibold min-h-10 inline-flex items-center gap-1"><Plus size={16} aria-hidden /> Ajouter</button>}>
        {races.length === 0 ? <p className="text-sm text-muted-foreground">Aucune course prévue.</p> : (
          <div className="space-y-2">
            {races.map((r) => (
              <Card key={r.id} className="p-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0"><Flag size={16} className="text-primary shrink-0" aria-hidden />
                  <span className="min-w-0"><span className="font-semibold block truncate">{r.name}</span><span className="text-xs text-muted-foreground">{dayLabel(r.date, today)} · {r.distanceKm} km{r.elevationM ? ` · D+ ${r.elevationM} m` : ''}{r.source === 'peakmind' ? ' · PeakMind' : ''}</span></span>
                </span>
                {r.source === 'manuel' && <button onClick={() => update((s) => removeRace(s, r.id))} className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground" aria-label={`Supprimer ${r.name}`}><Trash2 size={15} aria-hidden /></button>}
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Plan nutrition course */}
      {racePlan && (
        <Section title={`Plan nutrition · ${racePlan.race.name}`}>
          <div className="space-y-2">
            {racePlan.days.map((d) => (
              <Card key={d.date} className={`p-3.5 ${d.label === 'Jour J' ? 'ring-2 ring-primary/40' : ''}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">{d.label} <span className="text-xs text-muted-foreground font-normal capitalize">· {dayLabel(d.date, today, 'short')}</span></p>
                  {d.nutrition && <p className="text-xs text-muted-foreground">{d.nutrition.carbs.min}–{d.nutrition.carbs.max} g glucides</p>}
                </div>
                <p className="text-sm mt-1 text-foreground/85">{d.focus}</p>
                {d.ideas.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {d.ideas.map((r) => <Link key={r.id} href={`/recettes/${r.baseRecipeId ?? r.id}`} className="shrink-0 flex items-center gap-2 rounded-xl bg-muted px-2 py-1.5 text-xs"><RecipeThumb emoji={r.emoji} id={r.id} size={28} />{r.name}</Link>)}
                  </div>
                )}
              </Card>
            ))}
          </div>
          <PrimaryButton className="w-full mt-3" onClick={planRaceWeek}>Planifier les repas de la semaine de course</PrimaryButton>

          <Card className="p-4 mt-4 space-y-3 text-sm">
            <p className="font-semibold flex items-center gap-1.5"><Timer size={16} aria-hidden /> Jour J</p>
            <p>{racePlan.breakfast.text}{racePlan.breakfast.carbs && ` Vise ${racePlan.breakfast.carbs.min} à ${racePlan.breakfast.carbs.max} g de glucides.`}</p>
            <div>
              <p className="font-semibold">Ravitaillement · durée {racePlan.fueling.durationEstimated ? 'estimée' : 'visée'} {minutes(racePlan.fueling.estimatedMinutes)}</p>
              {racePlan.fueling.totalCarbs ? (
                <p className="mt-1">{racePlan.fueling.carbsPerHour!.min}–{racePlan.fueling.carbsPerHour!.max} g/h, soit {racePlan.fueling.totalCarbs.min}–{racePlan.fueling.totalCarbs.max} g au total (≈ {racePlan.fueling.gels!.min} à {racePlan.fueling.gels!.max} gels de 25 g). Boire {racePlan.fueling.fluidMlPerHour.min}–{racePlan.fueling.fluidMlPerHour.max} ml/h{racePlan.fueling.sodiumMgPerHour ? `, avec ${racePlan.fueling.sodiumMgPerHour.min}–${racePlan.fueling.sodiumMgPerHour.max} mg de sodium/h` : ''}.</p>
              ) : <p className="mt-1">Sur cette durée, pas besoin de glucides pendant l’effort.</p>}
              {racePlan.fueling.totalCarbs && (
                <ol className="mt-2 space-y-1">{racePlan.fueling.schedule.map((s, i) => <li key={i} className="flex gap-2"><span className="w-14 shrink-0 text-muted-foreground tabular-nums">{minutes(s.minute)}</span><span>{s.action}</span></li>)}</ol>
              )}
            </div>
            <div><p className="font-semibold">Après</p><ul className="list-disc pl-5 mt-1 space-y-1">{racePlan.recovery.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
            <Note>Teste ton ravitaillement à l’entraînement : jamais de nouveauté le jour de la course.{racePlan.fueling.durationEstimated ? ' Indique ton temps visé pour affiner les quantités.' : ''}</Note>
          </Card>
        </Section>
      )}

      <Link href="/batch" className="flex items-center justify-between rounded-2xl bg-card border border-border p-4 mb-6">
        <span className="flex items-center gap-3"><Activity size={18} className="text-primary" aria-hidden /><span><span className="font-semibold block">Batch cooking</span><span className="text-xs text-muted-foreground">Cuisiner en une fois pour plusieurs jours</span></span></span>
        <ChevronRight size={18} aria-hidden />
      </Link>

      <SessionSheet item={sessionSheet} onClose={() => setSessionSheet(null)} />
      <RaceSheet open={raceSheet} onClose={() => setRaceSheet(false)} onSave={(r) => { update((s) => upsertRace(s, r)); setRaceSheet(false) }} />
    </Page>
  )
}

function Target({ label, range, unit, planned }: { label: string; range: Range; unit: string; planned: number | null }) {
  const pct = planned != null ? Math.min(100, Math.round((planned / range.max) * 100)) : null
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--hero-ink-faint)' }}>{label}</p>
      <p className="font-semibold tabular-nums">{range.min.toLocaleString('fr-FR')}–{range.max.toLocaleString('fr-FR')} {unit}</p>
      {pct != null && (
        <div className="mt-1" aria-label={`Prévu : environ ${planned} ${unit}`}>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--hero-border)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--hero-ink)' }} /></div>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--hero-ink-faint)' }}>prévu ≈ {planned} {unit}</p>
        </div>
      )}
    </div>
  )
}

function SportSetup() {
  const { profile, update } = useMijote()
  const p = profile ?? DEFAULT_PROFILE
  const [weight, setWeight] = useState(p.sport?.weightKg ? String(p.sport.weightKg) : '')
  const save = () => {
    const w = Number(weight.replace(',', '.'))
    if (!Number.isFinite(w) || w < 30 || w > 250) return
    update((s) => setProfile(s, { ...p, sport: { ...DEFAULT_SPORT, ...p.sport, enabled: true, weightKg: w } }))
  }
  return (
    <Page>
      <PageHeader eyebrow="Nutrition sportive" title="Sport" />
      <Card className="p-5 space-y-4">
        <p className="font-semibold">Adapte tes repas à ton entraînement</p>
        <p className="text-sm text-muted-foreground">Mijote estime tes besoins du jour selon tes séances (glucides avant une sortie longue, protéines après la musculation), prépare tes semaines de course et oriente ton planning. Il suffit de ton poids pour commencer ; le reste se règle dans le profil.</p>
        <label className="block text-sm font-medium">Poids (kg)
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full min-h-11 rounded-xl border border-border bg-background px-3 text-base mt-1" placeholder="70" />
        </label>
        <PrimaryButton className="w-full" onClick={save} disabled={!weight}>Activer la nutrition sportive</PrimaryButton>
        <Note>Ton poids reste dans tes données Mijote et sert uniquement à ces calculs.</Note>
      </Card>
    </Page>
  )
}

const KINDS: { kind: SessionKind; sport: 'course' | 'renfo' }[] = [
  { kind: 'endurance', sport: 'course' }, { kind: 'sortie_longue', sport: 'course' }, { kind: 'seuil', sport: 'course' }, { kind: 'fractionne', sport: 'course' },
  { kind: 'recuperation', sport: 'course' }, { kind: 'trail', sport: 'course' }, { kind: 'force', sport: 'renfo' }, { kind: 'renfo_leger', sport: 'renfo' },
]

function SessionSheet({ item, onClose }: { item: TrainingSession | 'new' | null; onClose: () => void }) {
  const existing = item && item !== 'new' ? item : null
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()} title={existing ? 'Séance' : 'Ajouter une séance'}>
      {item && <SessionForm key={existing?.id ?? 'new'} existing={existing} onDone={onClose} />}
    </Sheet>
  )
}

function SessionForm({ existing, onDone }: { existing: TrainingSession | null; onDone: () => void }) {
  const { update, today, profile } = useMijote()
  const [date, setDate] = useState(existing?.date ?? today)
  const [kind, setKind] = useState<SessionKind>(existing?.kind ?? 'endurance')
  const [duration, setDuration] = useState(String(existing?.durationMinutes ?? 45))
  const [distance, setDistance] = useState(existing?.distanceKm ? String(existing.distanceKm) : '')
  const [time, setTime] = useState<TimeOfDay>(existing?.timeOfDay ?? profile?.sport?.defaultTimeOfDay ?? 'soir')
  const readOnly = existing?.source === 'peakmind'
  const save = () => {
    const d = Number(duration)
    if (!Number.isFinite(d) || d <= 0) return
    const dist = Number(distance.replace(',', '.'))
    const sport = KINDS.find((k) => k.kind === kind)!.sport
    update((s) => upsertSession(s, { id: existing?.id ?? newId('s'), date, sport, kind, durationMinutes: d, distanceKm: distance && Number.isFinite(dist) ? dist : undefined, timeOfDay: time, source: existing?.source ?? 'manuel', title: existing?.title }))
    onDone()
  }
  return (
    <div className="space-y-3">
      {readOnly && <Note>Séance synchronisée depuis PeakMind : tu peux changer le moment de la journée ; le reste se modifie dans PeakMind.</Note>}
      <input type="date" value={date} disabled={readOnly} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base disabled:opacity-60" />
      <div className="flex flex-wrap gap-2">{KINDS.map((k) => <Chip key={k.kind} active={kind === k.kind} onClick={() => !readOnly && setKind(k.kind)}>{SESSION_LABEL[k.kind]}</Chip>)}</div>
      <div className="flex gap-2">
        <label className="flex-1 text-sm">Durée (min)<input inputMode="numeric" disabled={readOnly} value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base mt-1 disabled:opacity-60" /></label>
        <label className="flex-1 text-sm">Distance (km)<input inputMode="decimal" disabled={readOnly} value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="facultatif" className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base mt-1 disabled:opacity-60" /></label>
      </div>
      <div className="flex gap-2">{(['matin', 'midi', 'soir'] as TimeOfDay[]).map((t) => <Chip key={t} active={time === t} onClick={() => setTime(t)}>{t === 'matin' ? 'Matin' : t === 'midi' ? 'Midi' : 'Soir'}</Chip>)}</div>
      <PrimaryButton className="w-full" onClick={save}>Enregistrer</PrimaryButton>
      {existing && !readOnly && <SecondaryButton className="w-full text-danger" onClick={() => { update((s) => removeSession(s, existing.id)); onDone() }}><Trash2 size={16} aria-hidden /> Supprimer</SecondaryButton>}
    </div>
  )
}

function RaceSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (r: StoredRace) => void }) {
  const { today } = useMijote()
  const [name, setName] = useState('')
  const [date, setDate] = useState(addDays(today, 14))
  const [distance, setDistance] = useState('')
  const [elevation, setElevation] = useState('')
  const [target, setTarget] = useState('')
  const save = () => {
    const d = Number(distance.replace(',', '.'))
    if (!name.trim() || !Number.isFinite(d) || d <= 0) return
    const m = target.match(/^(\d{1,2})[h:](\d{2})$/)
    const targetMinutes = m ? Number(m[1]) * 60 + Number(m[2]) : Number(target) || undefined
    onSave({ id: newId('r'), name: name.trim(), date, distanceKm: d, elevationM: Number(elevation) || undefined, targetMinutes, source: 'manuel' })
    setName(''); setDistance(''); setElevation(''); setTarget('')
  }
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Ajouter une course">
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Semi de Paris)" aria-label="Nom de la course" className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de la course" className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
        <div className="flex gap-2">
          <input inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="Distance (km)" aria-label="Distance" className="flex-1 min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
          <input inputMode="numeric" value={elevation} onChange={(e) => setElevation(e.target.value)} placeholder="D+ (m)" aria-label="Dénivelé positif" className="w-28 min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
        </div>
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Temps visé (ex. 1h45), facultatif" aria-label="Temps visé" className="w-full min-h-11 rounded-xl border border-border bg-card px-3 text-base" />
        <PrimaryButton className="w-full" onClick={save} disabled={!name || !distance}>Ajouter</PrimaryButton>
      </div>
    </Sheet>
  )
}
