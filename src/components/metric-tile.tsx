'use client'

import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import AnimatedNumber from '@/components/animated-number'

// Generalise le motif deja valide de ProgressRing (jauge animee) aux tuiles rectangulaires du
// dashboard : un chiffre seul ne raconte rien, une jauge + une tendance + une note le fait en un
// coup d'oeil (cf. audit interface, section "rendre les donnees plus vivantes"). Ne remplace aucune
// donnee existante -- prend exactement les memes valeurs qu'avant, juste presentees autrement.
export default function MetricTile({
  icon: Icon,
  label,
  value,
  decimals = 0,
  unit,
  pct,
  color = 'var(--primary)',
  trend,
  note,
  valueColor,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  decimals?: number
  unit?: string
  pct?: number // 0-100, jauge optionnelle
  color?: string
  trend?: { value: number; goodDirection?: 'up' | 'down' }
  note?: string
  valueColor?: string
}) {
  const isNumeric = typeof value === 'number'
  const trendUp = trend != null && trend.value > 0
  const trendGood = trend != null && (trend.goodDirection === 'down' ? trend.value < 0 : trend.value > 0)

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon size={13} />
        <p className="text-xs">{label}</p>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <p className="text-xl font-bold" style={valueColor ? { color: valueColor } : undefined}>
          {isNumeric ? <AnimatedNumber value={value as number} decimals={decimals} /> : value}
          {unit ? <span className="text-sm font-medium text-muted-foreground ml-0.5">{unit}</span> : null}
        </p>
        {trend != null && trend.value !== 0 && (
          <span className={`flex items-center text-xs font-semibold ${trendGood ? 'text-success' : 'text-warning'}`}>
            {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend.value)}
          </span>
        )}
      </div>
      {pct != null && (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2.5">
          <div
            className="h-full rounded-full transition-all ease-out"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color, transitionDuration: '800ms' }}
          />
        </div>
      )}
      {note && <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{note}</p>}
    </div>
  )
}
