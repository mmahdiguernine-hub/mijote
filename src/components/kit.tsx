'use client'

import Link from 'next/link'
import { Dialog } from 'radix-ui'
import { Minus, Plus, UserRound, X, Info } from 'lucide-react'
import type { Confidence } from '@/domain/types'
import { CONFIDENCE_LABEL } from '@/lib/format'

// Petits composants communs a tous les ecrans (memes conventions visuelles que PeakMind :
// cartes arrondies 2xl, libelles xs en muted, titres en Fraunces).

export function PageHeader({ eyebrow, title, action, profileLink = true }: { eyebrow?: string; title: string; action?: React.ReactNode; profileLink?: boolean }) {
  return (
    <header className="flex items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{eyebrow}</p>}
        <h1 className="font-heading text-[1.75rem] leading-tight font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {action}
        {profileLink && (
          <Link href="/profil" aria-label="Profil et préférences" className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center">
            <UserRound size={20} aria-hidden />
          </Link>
        )}
      </div>
    </header>
  )
}

export function Page({ children }: { children: React.ReactNode }) {
  return <main className="max-w-2xl mx-auto px-4 sm:px-5 pt-8 pb-8">{children}</main>
}

export function Section({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-2.5">
          {title && <h2 className="font-heading text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Card({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl bg-card border border-border ${className}`} {...rest}>{children}</div>
}

export function Chip({ active, onClick, children, className = '' }: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={`shrink-0 px-3 min-h-9 rounded-full text-sm font-medium border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border'} ${className}`}
    >
      {children}
    </button>
  )
}

export function Stepper({ value, onChange, min = 1, max = 20, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card" role="group" aria-label={label}>
      <button type="button" className="w-10 h-10 flex items-center justify-center disabled:opacity-40" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuer ${label}`}>
        <Minus size={16} aria-hidden />
      </button>
      <span className="min-w-8 text-center font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className="w-10 h-10 flex items-center justify-center disabled:opacity-40" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Augmenter ${label}`}>
        <Plus size={16} aria-hidden />
      </button>
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <Card className="p-6 text-center flex flex-col items-center">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3" aria-hidden>{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}

export function PrimaryButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`inline-flex items-center justify-center gap-2 px-4 min-h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 ${className}`}>
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`inline-flex items-center justify-center gap-2 px-4 min-h-11 rounded-xl bg-card border border-border text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 ${className}`}>
      {children}
    </button>
  )
}

/** Valeur estimee : toujours precedee de "≈" et accompagnee de sa fiabilite. */
export function Estimate({ children, confidence, title }: { children: React.ReactNode; confidence: Confidence; title?: string }) {
  const tone = confidence === 'faible' ? 'text-warning' : 'text-muted-foreground'
  return (
    <span className="inline-flex items-baseline gap-1" title={title ?? `Estimation ${CONFIDENCE_LABEL[confidence]}`}>
      <span aria-hidden>≈</span>
      <span>{children}</span>
      {confidence !== 'haute' && <span className={`text-[11px] ${tone}`}>({CONFIDENCE_LABEL[confidence]})</span>}
    </span>
  )
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground flex gap-1.5 items-start">
      <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/** Panneau du bas (mobile d'abord), accessible : focus piege, Echap, titre annonce. */
export function Sheet({ open, onOpenChange, title, children, description }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed z-[61] bottom-0 left-0 right-0 max-w-2xl mx-auto max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-background border-t border-border p-5 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <Dialog.Title className="font-heading text-xl font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="text-sm text-muted-foreground mt-0.5">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="w-10 h-10 -mr-2 -mt-1 rounded-full flex items-center justify-center" aria-label="Fermer">
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Vignette de recette en attendant les photos : emoji sur fond teinte stable. */
export function RecipeThumb({ emoji, id, size = 56 }: { emoji: string; id: string; size?: number }) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return (
    <div
      aria-hidden
      className="rounded-2xl flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5, background: `color-mix(in srgb, hsl(${h} 55% 60%) 22%, var(--card))` }}
    >
      {emoji}
    </div>
  )
}
