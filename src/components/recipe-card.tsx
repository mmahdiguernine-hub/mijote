'use client'

import Link from 'next/link'
import { Clock, Sparkles, Wand2 } from 'lucide-react'
import type { Scored } from '@/domain/scoring'
import { euro, minutes } from '@/lib/format'
import { Estimate, RecipeThumb } from './kit'

/** Ligne de recette : nom, temps, cout estime, et la raison principale de la suggestion. */
export function RecipeCard({ item, href, compact = false, trailing, asLink = true }: { item: Scored; href?: string; compact?: boolean; trailing?: React.ReactNode; asLink?: boolean }) {
  const { recipe, analysis, reasons, adaptedFrom } = item
  const baseId = adaptedFrom?.id ?? recipe.baseRecipeId ?? recipe.id
  const link = href ?? `/recettes/${baseId}${recipe.variant ? `?version=${recipe.variant.kind}` : ''}`
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
      <Wrapper href={link} asLink={asLink}>
        <RecipeThumb emoji={recipe.emoji} id={baseId} size={compact ? 48 : 56} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug truncate">{recipe.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden />{minutes(analysis.totalMinutes)}</span>
            <span>·</span>
            <Estimate confidence={analysis.costPerServing.confidence}>{euro(analysis.costPerServing.value)}/pers.</Estimate>
          </p>
          {!compact && (adaptedFrom || reasons[0]) && (
            <p className="text-xs mt-1 flex items-center gap-1 text-herb font-medium truncate">
              {adaptedFrom ? <Wand2 size={12} aria-hidden /> : <Sparkles size={12} aria-hidden />}
              {adaptedFrom ? 'Version adaptée à ton profil' : reasons[0]}
            </p>
          )}
        </div>
      </Wrapper>
      {trailing}
    </div>
  )
}

/** Dans un bouton (selection dans un panneau), la carte ne doit pas contenir de lien. */
function Wrapper({ href, asLink, children }: { href: string; asLink: boolean; children: React.ReactNode }) {
  const cls = 'flex items-center gap-3 flex-1 min-w-0'
  return asLink ? <Link href={href} className={cls}>{children}</Link> : <div className={cls}>{children}</div>
}
