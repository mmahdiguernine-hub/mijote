# Mijote

Recettes, planning des repas, liste de courses et stock, personnalisés. Même socle que PeakMind
(Next.js 16, React 19, Tailwind 4, shadcn/ui, Supabase, PWA, Vitest).

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # moteur métier (Vitest)
```

Sans variables d'environnement, l'app tourne en **mode local** (données dans le navigateur).
Pour les comptes et la synchronisation : créer un projet Supabase, exécuter
`supabase/migrations/*.sql`, puis renseigner `.env.local` (voir `.env.example`).

## Architecture

```
src/domain/        règles métier pures et testées (aucune dépendance React/Supabase)
  units.ts           conversions g / ml / pièce, refus d'inventer une conversion
  analysis.ts        coût, nutrition, allergènes, régimes, saison : calculés, avec taux de couverture
  constraints.ts     allergies, exclusions, régime, équipement = contraintes strictes
  scaling.ts         adaptation aux portions
  variants.ts        moteur de personnalisation (végé, économique, rapide, protéinée…)
  scoring.ts         classement explicable selon le profil
  planner.ts         génération du menu, remplacement, déplacement, restes
  shopping.ts        liste de courses : agrégation, stock daté, conditionnements, coût
  pantry.ts          stock, péremption, "c'est cuisiné", "courses faites"
  search.ts          recherche en langage naturel sans IA
src/data/          état utilisateur, actions pures, persistance (LocalStore / SupabaseStore)
src/data/catalog/  référentiel d'ingrédients et recettes de départ
src/app/           écrans
supabase/          schéma SQL + RLS
```

La liste de courses n'est jamais stockée : elle est recalculée depuis le planning, le stock et les
ajouts manuels. Seules les actions de l'utilisateur (coché, retiré, quantité imposée) sont gardées.

## Données estimées

Prix et valeurs nutritionnelles sont des **estimations** (ordres de grandeur type CIQUAL, prix moyens
en grande surface), toujours affichées avec « ≈ » et leur fiabilité. L'import CIQUAL / Open Food
Facts remplacera ces valeurs sans toucher au moteur.
