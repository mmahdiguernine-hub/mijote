'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, BookOpen, CalendarDays, ShoppingBasket, Refrigerator } from 'lucide-react'

// Meme barre que PeakMind (5 onglets, pouce, flou d'arriere-plan), en liens accessibles.
// Le profil est accessible depuis l'en-tete de chaque page.
const NAV_ITEMS = [
  { href: '/', icon: House, label: 'Accueil' },
  { href: '/recettes', icon: BookOpen, label: 'Recettes' },
  { href: '/planning', icon: CalendarDays, label: 'Planning' },
  { href: '/courses', icon: ShoppingBasket, label: 'Courses' },
  { href: '/frigo', icon: Refrigerator, label: 'Frigo' },
]

const HIDE_ON = ['/login', '/signup', '/bienvenue']

export default function BottomNav() {
  const pathname = usePathname()
  if (HIDE_ON.includes(pathname)) return null

  return (
    <nav aria-label="Navigation principale" className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-t border-border/60">
      <div className="max-w-2xl mx-auto flex items-stretch justify-around px-2 pt-1.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-12 transition-transform active:scale-90"
            >
              <Icon size={24} strokeWidth={isActive ? 2.3 : 1.8} className={isActive ? 'text-primary' : 'text-muted-foreground'} aria-hidden />
              <span className={`text-[11px] leading-none tracking-tight whitespace-nowrap ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
