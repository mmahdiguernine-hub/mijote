'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, Share, SquarePlus, X } from 'lucide-react'

const DISMISS_KEY = 'mijote_install_prompt_dismissed_at'
const DISMISS_DAYS = 14
const HIDE_ON = ['/login', '/signup', '/onboarding']

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function recentlyDismissed() {
  if (typeof window === 'undefined') return false
  const dismissedAt = localStorage.getItem(DISMISS_KEY)
  return !!dismissedAt && Date.now() - parseInt(dismissedAt, 10) < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

// Manifest+service worker sont deja en place (PWA installable depuis le debut), mais rien ne l'a
// jamais propose a l'utilisateur -- une app censee etre ouverte tous les jours gagne beaucoup a
// vivre en icone d'accueil plutot qu'en onglet de navigateur perdu. Android/Chrome expose un vrai
// bouton d'installation (evenement beforeinstallprompt) ; iOS/Safari n'a AUCUNE API pour ca, donc
// seule une instruction manuelle (Partage -> Sur l'ecran d'accueil) est possible.
export default function InstallPrompt() {
  const pathname = usePathname()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  // Lazy init (pas un effect) : lit juste l'etat actuel du navigateur au premier rendu, aucune
  // synchronisation externe requise -- contrairement au listener beforeinstallprompt ci-dessous.
  const [showIos] = useState(() => !isStandalone() && !recentlyDismissed() && isIOS())
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (dismissed || HIDE_ON.includes(pathname)) return null
  if (!deferredPrompt && !showIos) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  return (
    <div className="fixed left-3 right-3 z-40 max-w-2xl mx-auto rounded-2xl border border-border bg-card shadow-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {deferredPrompt ? <Download size={18} className="text-primary" /> : <Share size={18} className="text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Installe Mijote</p>
        {deferredPrompt ? (
          <p className="text-xs text-muted-foreground mt-0.5">Ton planning et ta liste de courses en un tap, même au supermarché.</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
            Appuie sur <Share size={12} className="inline shrink-0" /> puis <SquarePlus size={12} className="inline shrink-0" /> « Sur l&apos;écran d&apos;accueil ».
          </p>
        )}
        {deferredPrompt && (
          <button onClick={install} className="mt-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-transform">
            Installer
          </button>
        )}
      </div>
      <button onClick={dismiss} className="text-muted-foreground shrink-0 p-1 -m-1" aria-label="Fermer">
        <X size={16} />
      </button>
    </div>
  )
}
