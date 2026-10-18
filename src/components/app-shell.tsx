'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CloudOff, TriangleAlert } from 'lucide-react'
import { useMijote } from '@/data/mijote-provider'
import { PageSkeleton } from '@/components/skeleton'

const PUBLIC_PATHS = ['/login', '/signup']

/** Etats globaux : chargement, erreur, profil a creer, synchronisation en echec. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { status, error, syncError, profile } = useMijote()
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = PUBLIC_PATHS.includes(pathname)
  const needsOnboarding = status === 'pret' && !profile?.onboardingDone && pathname !== '/bienvenue' && !isPublic

  useEffect(() => {
    if (needsOnboarding) router.replace('/bienvenue')
  }, [needsOnboarding, router])

  if (isPublic) return <>{children}</>
  if (status === 'chargement' || needsOnboarding) return <PageSkeleton hero cards={3} />
  if (status === 'erreur') {
    return (
      <main className="max-w-2xl mx-auto px-5 pt-16">
        <div role="alert" className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-danger font-semibold"><TriangleAlert size={18} aria-hidden /> Impossible de charger tes données</div>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <button onClick={() => location.reload()} className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Réessayer</button>
        </div>
      </main>
    )
  }
  return (
    <>
      {syncError && (
        <div role="status" className="max-w-2xl mx-auto mx-4 mt-2 rounded-xl bg-warning/10 text-warning text-xs px-3 py-2 flex items-center gap-2">
          <CloudOff size={14} aria-hidden /> Modifications enregistrées sur cet appareil, synchronisation en attente.
        </div>
      )}
      {children}
    </>
  )
}
