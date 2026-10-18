import { buildCatalog } from '@/domain/catalog'
import { INGREDIENTS } from './ingredients'
import { RECIPES } from './recipes'

/** Catalogue de depart, embarque dans l'app (fonctionne hors ligne, sans base de donnees). */
export const CATALOG = buildCatalog(INGREDIENTS, RECIPES)
export { INGREDIENTS, RECIPES }
