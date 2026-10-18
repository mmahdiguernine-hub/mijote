'use client'

import { useEffect, useRef, useState } from 'react'

// Anime un chiffre de sa valeur precedente vers la nouvelle (jamais un "saut" instantane) --
// requestAnimationFrame pur, aucune dependance, cout CPU negligeable (une seule valeur interpolee
// par frame). Reutilisable partout ou une stat change : VO2max, km, %, etc.
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export default function AnimatedNumber({
  value,
  decimals = 0,
  duration = 700,
  suffix = '',
  prefix = '',
  className,
}: {
  value: number
  decimals?: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return

    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      const eased = easeOutCubic(t)
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  )
}
