import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Fraunces } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import BottomNav from '@/components/bottom-nav'
import InstallPrompt from '@/components/install-prompt'
import AppShell from '@/components/app-shell'
import { ThemeProvider } from '@/components/theme-provider'
import { MijoteProvider } from '@/data/mijote-provider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
// Meme duo que PeakMind (serif organique pour les titres, Geist pour les chiffres) : continuite
// entre les deux apps, l'identite propre a Mijote passe par la palette.
const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Mijote',
  description: 'Recettes, planning des repas et liste de courses, à ta façon.',
  manifest: '/manifest.json',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }] },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Mijote' },
}

export const viewport: Viewport = {
  themeColor: '#F6F0E7',
  viewportFit: 'cover',
}

// Applique la palette choisie avant le premier rendu (pas de flash de couleur).
const PALETTE_SCRIPT = `try{var p=localStorage.getItem('mijote:palette');if(p&&p!=='terracotta')document.documentElement.setAttribute('data-palette',p)}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased pb-24 pt-[env(safe-area-inset-top)]`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MijoteProvider>
            <AppShell>{children}</AppShell>
            <InstallPrompt />
            <BottomNav />
          </MijoteProvider>
          <Script id="register-sw" strategy="afterInteractive">{`
            if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
              navigator.serviceWorker.register('/sw.js')
            }
          `}</Script>
        </ThemeProvider>
      </body>
    </html>
  )
}
