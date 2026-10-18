'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Profile } from '@/domain/types'
import { withRecipes, type Catalog } from '@/domain/catalog'
import type { VariantContext } from '@/domain/variants'
import type { ScoreContext } from '@/domain/scoring'
import { CATALOG } from '@/data/catalog'
import { createClient } from '@/lib/supabase/client'
import { EMPTY_STATE, localISO, type UserState } from './state'
import { LocalStore, SupabaseStore, isSupabaseConfigured, type UserStore } from './store'

// Etat global de l'app : charge une fois, modifie par les fonctions pures de actions.ts, persiste
// en arriere-plan. Les ecritures sont serialisees (une a la fois) : si une synchronisation echoue,
// la suivante repart du dernier etat reellement enregistre et rattrape donc ce qui manquait.

type Status = 'chargement' | 'pret' | 'erreur'

type MijoteContextValue = {
  status: Status
  error: string | null
  syncError: string | null
  mode: 'local' | 'cloud'
  state: UserState
  catalog: Catalog
  today: string
  profile: Profile | null
  update: (fn: (s: UserState) => UserState) => void
  variantCtx: VariantContext
  scoreCtx: ScoreContext | null
}

const MijoteContext = createContext<MijoteContextValue | null>(null)

const PUBLIC_PATHS = ['/login', '/signup']

export function MijoteProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('chargement')
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [state, setState] = useState<UserState>(EMPTY_STATE)
  const [today, setToday] = useState(() => localISO())
  const storeRef = useRef<UserStore | null>(null)
  const persisted = useRef<UserState>(EMPTY_STATE)
  const queue = useRef<Promise<void>>(Promise.resolve())
  // L'etat courant vit aussi dans une ref : la transition est calculee UNE fois, hors du setState
  // (React rejoue les fonctions de mise a jour en developpement, ce qui dupliquerait les ecritures
  // et les identifiants generes).
  const current = useRef<UserState>(EMPTY_STATE)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname) && isSupabaseConfigured()) return
    let cancelled = false
    ;(async () => {
      try {
        let store: UserStore
        if (isSupabaseConfigured()) {
          const db = createClient()
          const { data } = await db.auth.getUser()
          if (!data.user) {
            router.replace('/login')
            return
          }
          store = new SupabaseStore(db, data.user.id)
        } else {
          store = new LocalStore()
        }
        const loaded = await store.load()
        if (cancelled) return
        storeRef.current = store
        persisted.current = loaded
        current.current = loaded
        setState(loaded)
        setStatus('pret')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('erreur')
      }
    })()
    return () => {
      cancelled = true
    }
    // Chargement unique ; la page de connexion recharge l'app apres authentification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // La date change a minuit si l'app reste ouverte.
  useEffect(() => {
    const t = setInterval(() => setToday(localISO()), 60_000)
    return () => clearInterval(t)
  }, [])

  const update = useCallback((fn: (s: UserState) => UserState) => {
    const prev = current.current
    const next = fn(prev)
    if (next === prev) return
    current.current = next
    setState(next)
    const store = storeRef.current
    if (!store) return
    queue.current = queue.current.then(async () => {
      try {
        await store.persist(persisted.current, next)
        persisted.current = next
        setSyncError(null)
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : 'Synchronisation impossible')
      }
    })
  }, [])

  const catalog = useMemo(() => withRecipes(CATALOG, state.userRecipes), [state.userRecipes])
  const profile = state.profile
  const month = Number(today.slice(5, 7))
  const variantCtx = useMemo<VariantContext>(() => ({ catalog, profile: profile ?? undefined, pantry: state.pantry, month }), [catalog, profile, state.pantry, month])
  const scoreCtx = useMemo<ScoreContext | null>(() => {
    if (!profile) return null
    const recentlyEaten = new Map<string, number>()
    for (const e of state.plan) {
      if (!e.recipeId || e.kind !== 'recette') continue
      const d = Math.abs((Date.parse(today) - Date.parse(e.date)) / 86400000)
      if (d <= 21) recentlyEaten.set(e.recipeId, Math.min(d, recentlyEaten.get(e.recipeId) ?? 99))
    }
    return { profile, catalog, month, today, pantry: state.pantry, recentlyEaten }
  }, [profile, catalog, month, today, state.pantry, state.plan])

  const value: MijoteContextValue = {
    status, error, syncError, mode: isSupabaseConfigured() ? 'cloud' : 'local',
    state, catalog, today, profile, update, variantCtx, scoreCtx,
  }
  return <MijoteContext.Provider value={value}>{children}</MijoteContext.Provider>
}

export function useMijote(): MijoteContextValue {
  const ctx = useContext(MijoteContext)
  if (!ctx) throw new Error('useMijote doit etre utilise sous <MijoteProvider>')
  return ctx
}
