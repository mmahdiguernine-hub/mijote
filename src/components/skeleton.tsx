// Bloc de chargement generique (balayage lumineux, skeleton-shimmer dans globals.css) -- remplace
// le spinner plein ecran unique qui bloquait tout affichage jusqu'a ce que TOUTES les requetes
// d'une page soient terminees (cf. audit interface, "rien n'est visible avant que TOUT soit
// charge"). Compose ces blocs pour dessiner la silhouette de la vraie page : l'utilisateur voit
// immediatement la structure, pas un ecran vide.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl ${className}`} />
}

// Silhouette generique reutilisable (titre + hero optionnel + N cartes) -- couvre les pages plus
// simples (races/export/settings/predict/race-week/chat) sans reconstruire un composant dedie pour
// chacune : jusqu'ici, seuls /coach et /plan avaient un skeleton, les 9 autres pages restaient sur
// un spinner plein ecran qui bloque tout affichage jusqu'a la fin du chargement (cf. audit
// interface -- meme correctif que DashboardSkeleton, generalise plutot qu'applique une seule fois).
export function PageSkeleton({ hero = false, cards = 3, rows }: { hero?: boolean; cards?: number; rows?: number }) {
  return (
    <div className="px-5 pt-12 pb-28 space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-44 mb-2" />
      {hero && <Skeleton className="h-32 rounded-2xl mb-1" />}
      {Array.from({ length: cards }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      {rows != null && (
        <div className="space-y-2 pt-2">
          {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      )}
    </div>
  )
}

// Silhouette du dashboard /coach, dans le meme ordre que le vrai contenu (hero seance -> tuiles ->
// missions) -- pour que l'apparition du vrai contenu ne "saute" pas visuellement une fois charge.
export function DashboardSkeleton() {
  return (
    <div className="px-5 pt-12 pb-28 space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-40 mb-2" />
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  )
}
