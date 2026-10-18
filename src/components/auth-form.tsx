'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PrimaryButton } from '@/components/kit'

// Repris de PeakMind (login/signup Supabase email + mot de passe, messages traduits).
function translateError(message: string, mode: 'login' | 'signup'): string {
  if (mode === 'login') return 'Email ou mot de passe incorrect.'
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already exists')) return 'Un compte existe déjà avec cet email.'
  if (m.includes('password') && (m.includes('6 characters') || m.includes('at least'))) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (m.includes('invalid') && m.includes('email')) return 'Adresse email invalide.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives, réessaie dans quelques minutes.'
  return 'Impossible de créer le compte, réessaie.'
}

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (error) {
      setError(translateError(error.message, mode))
      setLoading(false)
      return
    }
    if (mode === 'signup' && !data.session) {
      setInfo('Compte créé : confirme ton adresse via l’email reçu, puis connecte-toi.')
      setLoading(false)
      return
    }
    // Rechargement complet : l'etat de l'app est charge une fois, avec la session.
    location.href = '/'
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="text-center">
          <p className="text-4xl" aria-hidden>🍲</p>
          <h1 className="font-heading text-2xl font-semibold mt-1">Mijote</h1>
          <p className="text-sm text-muted-foreground">{mode === 'login' ? 'Connecte-toi pour retrouver tes menus' : 'Crée ton compte'}</p>
        </div>
        <label className="block text-sm font-medium">Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full min-h-11 rounded-xl border border-border bg-background px-3 text-base mt-1" />
        </label>
        <label className="block text-sm font-medium">Mot de passe
          <input type="password" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full min-h-11 rounded-xl border border-border bg-background px-3 text-base mt-1" />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {info && <p role="status" className="text-sm text-success">{info}</p>}
        <PrimaryButton type="submit" className="w-full" disabled={loading}>{loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</PrimaryButton>
        <p className="text-sm text-muted-foreground text-center">
          {mode === 'login'
            ? <>Pas encore de compte ? <Link href="/signup" className="text-primary font-semibold">S’inscrire</Link></>
            : <>Déjà inscrit ? <Link href="/login" className="text-primary font-semibold">Se connecter</Link></>}
        </p>
      </form>
    </main>
  )
}
