import type { Aisle, Allergen, BaseUnit, Ingredient, IngredientTag, Nutrition } from '@/domain/types'

// Referentiel d'ingredients de depart.
//
// HONNETETE DES DONNEES -- a lire avant de modifier :
// - Nutrition : valeurs moyennes pour 100 g (ou 100 ml) d'aliment cru, ARRONDIES et inspirees des
//   ordres de grandeur de la table CIQUAL (ANSES). Ce ne sont pas des extraits officiels : elles sont
//   marquees `ciqual_approx` et toujours affichees comme estimations. L'import du fichier CIQUAL
//   complet (licence ouverte Etalab) remplacera ces valeurs sans changer le moteur.
// - Prix : estimations de prix moyens en grande surface en France (2026), marquees `estimation`.
//   Aucune API publique fiable de prix supermarche n'existe aujourd'hui ; l'utilisateur pourra
//   corriger un prix, qui passera en source `user`.
// - Allergenes : ceux de l'ingredient type. Les recettes industrielles varient d'une marque a
//   l'autre : l'app rappelle toujours de verifier l'etiquette en cas d'allergie.

const n = (kcal: number, protein: number, carbs: number, fat: number, fiber: number, sugar = 0, salt = 0): Nutrition => ({ kcal, protein, carbs, fat, fiber, sugar, salt })
const months = (...m: number[]) => m

type Opts = Partial<Omit<Ingredient, 'id' | 'name' | 'aisle' | 'baseUnit'>> & { a?: Allergen[]; t?: IngredientTag[]; price?: number; nut?: Nutrition }

function ing(id: string, name: string, aisle: Aisle, baseUnit: BaseUnit, o: Opts = {}): Ingredient {
  const { a, t, price, nut, ...rest } = o
  return {
    id, name, aisle, baseUnit,
    allergens: a ?? [],
    tags: t ?? [],
    nutrition: nut,
    nutritionSource: nut ? 'ciqual_approx' : undefined,
    pricePerKgOrUnit: price,
    priceSource: price != null ? 'estimation' : undefined,
    ...rest,
  }
}

const SUMMER = months(6, 7, 8, 9)
const LATE_SUMMER = months(6, 7, 8, 9, 10)

export const INGREDIENTS: Ingredient[] = [
  // --- Fruits et legumes -------------------------------------------------------------------
  ing('oignon', 'Oignon', 'fruits_legumes', 'g', { plural: 'Oignons', pieceGrams: 100, price: 2.2, t: ['legume'], nut: n(40, 1.2, 7, 0.2, 1.8, 5), shelfLifeDays: 30 }),
  ing('oignon_rouge', 'Oignon rouge', 'fruits_legumes', 'g', { plural: 'Oignons rouges', pieceGrams: 100, price: 3.5, t: ['legume'], nut: n(40, 1.2, 7, 0.2, 1.8, 5), shelfLifeDays: 30 }),
  ing('echalote', 'Échalote', 'fruits_legumes', 'g', { plural: 'Échalotes', pieceGrams: 30, price: 6, t: ['legume'], nut: n(72, 2.5, 14, 0.1, 3, 8), shelfLifeDays: 30 }),
  ing('ail', 'Ail', 'fruits_legumes', 'g', { pieceGrams: 5, unitSizes: { gousse: 5 }, packages: [50], price: 10, t: ['legume', 'herbe_epice'], nut: n(130, 6, 25, 0.5, 2, 1), shelfLifeDays: 60 }),
  ing('carotte', 'Carotte', 'fruits_legumes', 'g', { plural: 'Carottes', pieceGrams: 120, price: 1.6, t: ['legume'], nut: n(36, 0.8, 6.5, 0.3, 2.7, 5), shelfLifeDays: 21 }),
  ing('courgette', 'Courgette', 'fruits_legumes', 'g', { plural: 'Courgettes', pieceGrams: 250, price: 2.8, t: ['legume'], seasonMonths: LATE_SUMMER, nut: n(17, 1.2, 2, 0.4, 1.1, 1.7), shelfLifeDays: 7 }),
  ing('aubergine', 'Aubergine', 'fruits_legumes', 'g', { plural: 'Aubergines', pieceGrams: 300, price: 3.5, t: ['legume'], seasonMonths: LATE_SUMMER, nut: n(25, 1, 4, 0.2, 2.5, 3), shelfLifeDays: 7 }),
  ing('poivron', 'Poivron', 'fruits_legumes', 'g', { plural: 'Poivrons', pieceGrams: 180, price: 4, t: ['legume'], seasonMonths: LATE_SUMMER, nut: n(27, 0.9, 4.6, 0.3, 1.8, 4), shelfLifeDays: 10 }),
  ing('tomate', 'Tomate', 'fruits_legumes', 'g', { plural: 'Tomates', pieceGrams: 120, price: 3, t: ['legume'], seasonMonths: SUMMER, nut: n(18, 0.9, 2.6, 0.2, 1.2, 2.6), shelfLifeDays: 7 }),
  ing('tomate_cerise', 'Tomates cerises', 'fruits_legumes', 'g', { packages: [250], price: 7, t: ['legume'], seasonMonths: SUMMER, nut: n(20, 1, 3, 0.2, 1.3, 3), shelfLifeDays: 7 }),
  ing('concombre', 'Concombre', 'fruits_legumes', 'piece', { plural: 'Concombres', pieceGrams: 350, price: 0.9, t: ['legume'], seasonMonths: months(5, 6, 7, 8, 9), nut: n(12, 0.6, 1.8, 0.1, 0.6, 1.7), shelfLifeDays: 7 }),
  ing('salade_verte', 'Salade verte', 'fruits_legumes', 'piece', { plural: 'Salades', aliases: ['laitue', 'batavia', 'salade'], pieceGrams: 300, price: 1.2, t: ['legume'], seasonMonths: months(4, 5, 6, 7, 8, 9, 10), nut: n(15, 1.2, 1.5, 0.2, 1.3, 1), shelfLifeDays: 5 }),
  ing('epinards', 'Épinards frais', 'fruits_legumes', 'g', { aliases: ['epinard', 'pousses d epinard'], packages: [250], price: 8, t: ['legume'], seasonMonths: months(3, 4, 5, 9, 10, 11), nut: n(23, 2.9, 1.4, 0.4, 2.2, 0.4, 0.1), shelfLifeDays: 3 }),
  ing('brocoli', 'Brocoli', 'fruits_legumes', 'g', { plural: 'Brocolis', pieceGrams: 500, price: 3.5, t: ['legume'], seasonMonths: months(6, 7, 8, 9, 10, 11), nut: n(34, 2.8, 4, 0.4, 2.6, 1.7), shelfLifeDays: 5 }),
  ing('chou_fleur', 'Chou-fleur', 'fruits_legumes', 'g', { pieceGrams: 1000, price: 2.5, t: ['legume'], seasonMonths: months(9, 10, 11, 12, 1, 2, 3, 4), nut: n(25, 2, 2.5, 0.3, 2.4, 2), shelfLifeDays: 7 }),
  ing('poireau', 'Poireau', 'fruits_legumes', 'g', { plural: 'Poireaux', pieceGrams: 200, price: 2.8, t: ['legume'], seasonMonths: months(9, 10, 11, 12, 1, 2, 3, 4), nut: n(30, 1.5, 4, 0.3, 2.2, 2), shelfLifeDays: 10 }),
  ing('champignon', 'Champignons de Paris', 'fruits_legumes', 'g', { aliases: ['champignon', 'champignons'], packages: [250, 500], price: 5, t: ['legume'], nut: n(22, 2.3, 0.6, 0.3, 1.3, 0.2), shelfLifeDays: 5 }),
  ing('pomme_de_terre', 'Pomme de terre', 'fruits_legumes', 'g', { plural: 'Pommes de terre', aliases: ['patate', 'patates'], pieceGrams: 150, price: 1.5, t: ['legume', 'feculent'], nut: n(80, 2, 17, 0.1, 1.8, 0.6), shelfLifeDays: 30 }),
  ing('patate_douce', 'Patate douce', 'fruits_legumes', 'g', { plural: 'Patates douces', pieceGrams: 300, price: 3.5, t: ['legume', 'feculent'], seasonMonths: months(9, 10, 11, 12, 1, 2, 3), nut: n(86, 1.6, 18, 0.1, 3, 4), shelfLifeDays: 21 }),
  ing('potiron', 'Courge (butternut, potimarron)', 'fruits_legumes', 'g', { aliases: ['potiron', 'potimarron', 'butternut', 'courge'], pieceGrams: 1200, price: 2.5, t: ['legume'], seasonMonths: months(9, 10, 11, 12, 1, 2), nut: n(40, 1, 8, 0.1, 2, 4), shelfLifeDays: 30 }),
  ing('haricots_verts', 'Haricots verts frais', 'fruits_legumes', 'g', { aliases: ['haricots verts'], price: 7, t: ['legume'], seasonMonths: SUMMER, nut: n(31, 1.8, 4, 0.2, 3.4, 1.5), shelfLifeDays: 4 }),
  ing('avocat', 'Avocat', 'fruits_legumes', 'piece', { plural: 'Avocats', pieceGrams: 200, price: 1, t: ['fruit', 'legume'], nut: n(160, 2, 2, 15, 6.7, 0.7), shelfLifeDays: 5 }),
  ing('citron', 'Citron', 'fruits_legumes', 'piece', { plural: 'Citrons', pieceGrams: 120, price: 0.45, t: ['fruit'], nut: n(29, 0.9, 3, 0.3, 2.8, 2.5), shelfLifeDays: 21 }),
  ing('citron_vert', 'Citron vert', 'fruits_legumes', 'piece', { plural: 'Citrons verts', pieceGrams: 70, price: 0.5, t: ['fruit'], nut: n(30, 0.7, 3.5, 0.2, 2.8, 1.7), shelfLifeDays: 21 }),
  ing('pomme', 'Pomme', 'fruits_legumes', 'g', { plural: 'Pommes', pieceGrams: 150, price: 2.8, t: ['fruit'], seasonMonths: months(8, 9, 10, 11, 12, 1, 2, 3, 4), nut: n(52, 0.3, 12, 0.2, 2, 10), shelfLifeDays: 21 }),
  ing('banane', 'Banane', 'fruits_legumes', 'g', { plural: 'Bananes', pieceGrams: 120, price: 2, t: ['fruit'], nut: n(90, 1.1, 20, 0.3, 2, 15), shelfLifeDays: 6 }),
  ing('poire', 'Poire', 'fruits_legumes', 'g', { plural: 'Poires', pieceGrams: 160, price: 3, t: ['fruit'], seasonMonths: months(8, 9, 10, 11, 12, 1), nut: n(50, 0.4, 11, 0.1, 3, 9), shelfLifeDays: 10 }),
  ing('orange', 'Orange', 'fruits_legumes', 'g', { plural: 'Oranges', pieceGrams: 200, price: 2.5, t: ['fruit'], seasonMonths: months(11, 12, 1, 2, 3, 4), nut: n(45, 0.9, 9, 0.2, 2, 8.5), shelfLifeDays: 14 }),
  ing('gingembre', 'Gingembre frais', 'fruits_legumes', 'g', { aliases: ['gingembre'], price: 9, t: ['herbe_epice'], nut: n(80, 1.8, 15, 0.8, 2, 1.7), shelfLifeDays: 21 }),
  ing('persil', 'Persil', 'fruits_legumes', 'g', { unitSizes: { botte: 30 }, packages: [30], price: 33, t: ['herbe_epice'], nut: n(36, 3, 2, 0.8, 4), shelfLifeDays: 5 }),
  ing('coriandre', 'Coriandre', 'fruits_legumes', 'g', { unitSizes: { botte: 30 }, packages: [30], price: 33, t: ['herbe_epice'], nut: n(25, 2, 1, 0.5, 3), shelfLifeDays: 5 }),
  ing('basilic', 'Basilic', 'fruits_legumes', 'g', { unitSizes: { botte: 20 }, packages: [20], price: 75, t: ['herbe_epice'], nut: n(25, 3, 1, 0.6, 3), shelfLifeDays: 5 }),
  ing('ciboulette', 'Ciboulette', 'fruits_legumes', 'g', { unitSizes: { botte: 20 }, packages: [20], price: 60, t: ['herbe_epice'], nut: n(30, 3, 2, 0.7, 2.5), shelfLifeDays: 5 }),
  ing('menthe', 'Menthe', 'fruits_legumes', 'g', { unitSizes: { botte: 20 }, packages: [20], price: 60, t: ['herbe_epice'], nut: n(45, 3.5, 5, 0.7, 7), shelfLifeDays: 5 }),
  ing('celeri', 'Céleri branche', 'fruits_legumes', 'g', { aliases: ['celeri'], pieceGrams: 40, price: 3, a: ['celeri'], t: ['legume'], nut: n(15, 0.7, 1.5, 0.2, 1.6, 1.3, 0.2), shelfLifeDays: 10 }),
  ing('radis', 'Radis', 'fruits_legumes', 'g', { unitSizes: { botte: 250 }, packages: [250], price: 6, t: ['legume'], seasonMonths: months(3, 4, 5, 6, 7), nut: n(16, 0.7, 2, 0.1, 1.6, 2), shelfLifeDays: 5 }),
  ing('betterave', 'Betterave cuite', 'fruits_legumes', 'g', { aliases: ['betterave'], packages: [250, 500], price: 3, t: ['legume'], nut: n(45, 1.7, 8, 0.1, 2, 7), shelfLifeDays: 7 }),

  // --- Viandes et poissons ------------------------------------------------------------------
  ing('blanc_poulet', 'Blanc de poulet', 'boucherie_poisson', 'g', { aliases: ['poulet', 'filet de poulet', 'escalope de poulet'], pieceGrams: 140, packages: [300, 600], price: 14, t: ['volaille'], nut: n(110, 23, 0, 1.8, 0, 0, 0.2), shelfLifeDays: 3 }),
  ing('cuisse_poulet', 'Cuisse de poulet', 'boucherie_poisson', 'g', { plural: 'Cuisses de poulet', aliases: ['poulet', 'cuisses de poulet', 'pilons'], pieceGrams: 250, packages: [500, 1000], price: 7, t: ['volaille'], nut: n(180, 18, 0, 12, 0, 0, 0.2), shelfLifeDays: 3 }),
  ing('boeuf_hache', 'Bœuf haché', 'boucherie_poisson', 'g', { aliases: ['viande hachee', 'steak hache', 'boeuf hache', 'hache'], packages: [350, 500], price: 13, t: ['viande_rouge'], nut: n(210, 19, 0, 15, 0, 0, 0.2), shelfLifeDays: 2 }),
  ing('boeuf_braiser', 'Bœuf à braiser', 'boucherie_poisson', 'g', { aliases: ['boeuf', 'paleron', 'joue de boeuf', 'boeuf bourguignon'], packages: [500, 1000], price: 16, t: ['viande_rouge'], nut: n(160, 21, 0, 8, 0, 0, 0.2), shelfLifeDays: 3 }),
  ing('filet_mignon_porc', 'Filet mignon de porc', 'boucherie_poisson', 'g', { aliases: ['porc', 'filet mignon'], packages: [500], price: 15, t: ['porc'], nut: n(120, 21, 0, 4, 0, 0, 0.2), shelfLifeDays: 3 }),
  ing('lardons', 'Lardons', 'boucherie_poisson', 'g', { packages: [150, 300], price: 12, t: ['porc', 'charcuterie'], nut: n(270, 16, 0.5, 23, 0, 0, 2.5), shelfLifeDays: 14 }),
  ing('jambon_blanc', 'Jambon blanc', 'boucherie_poisson', 'g', { aliases: ['jambon'], unitSizes: { tranche: 45 }, packages: [180, 360], price: 15, t: ['porc', 'charcuterie'], nut: n(115, 20, 1, 3.5, 0, 0.5, 1.9), shelfLifeDays: 7 }),
  ing('chorizo', 'Chorizo', 'boucherie_poisson', 'g', { packages: [100, 200], price: 18, t: ['porc', 'charcuterie'], nut: n(450, 24, 2, 38, 0, 1, 4), shelfLifeDays: 30 }),
  ing('saucisse', 'Saucisse de Toulouse', 'boucherie_poisson', 'g', { plural: 'Saucisses de Toulouse', aliases: ['saucisse', 'saucisses'], pieceGrams: 110, packages: [450], price: 10, t: ['porc', 'charcuterie'], nut: n(280, 15, 1, 24, 0, 0.5, 2), shelfLifeDays: 4 }),
  ing('saumon', 'Pavé de saumon', 'boucherie_poisson', 'g', { plural: 'Pavés de saumon', aliases: ['saumon'], pieceGrams: 130, packages: [250, 500], price: 25, a: ['poisson'], t: ['poisson'], nut: n(200, 20, 0, 13, 0, 0, 0.1), shelfLifeDays: 2 }),
  ing('cabillaud', 'Dos de cabillaud', 'boucherie_poisson', 'g', { aliases: ['cabillaud', 'poisson blanc', 'poisson'], pieceGrams: 140, packages: [300], price: 25, a: ['poisson'], t: ['poisson'], nut: n(80, 18, 0, 0.7, 0, 0, 0.2), shelfLifeDays: 2 }),
  ing('crevettes', 'Crevettes cuites décortiquées', 'boucherie_poisson', 'g', { aliases: ['crevettes', 'crevette'], packages: [150, 300], price: 25, a: ['crustaces'], t: ['fruits_de_mer'], nut: n(95, 21, 0, 1.1, 0, 0, 1.5), shelfLifeDays: 3 }),

  // --- Cremerie et frais --------------------------------------------------------------------
  ing('oeuf', 'Œuf', 'cremerie', 'piece', { plural: 'Œufs', aliases: ['oeuf', 'oeufs'], pieceGrams: 55, packages: [6, 12], price: 0.3, a: ['oeufs'], t: ['oeuf'], nut: n(140, 12.5, 0.7, 9.7, 0, 0.4, 0.3), shelfLifeDays: 21 }),
  ing('lait', 'Lait demi-écrémé', 'cremerie', 'ml', { aliases: ['lait'], density: 1.03, packages: [1000], price: 1.1, a: ['lait'], t: ['produit_laitier'], nut: n(46, 3.2, 4.8, 1.6, 0, 4.8, 0.1), shelfLifeDays: 30 }),
  ing('beurre', 'Beurre', 'cremerie', 'g', { density: 0.91, packages: [250], price: 10, a: ['lait'], t: ['produit_laitier', 'matiere_grasse'], nut: n(745, 0.7, 0.6, 82, 0, 0.6, 0.05), shelfLifeDays: 30 }),
  ing('creme_fraiche', 'Crème fraîche épaisse', 'cremerie', 'ml', { aliases: ['creme fraiche'], density: 1, packages: [200, 400], price: 7.5, a: ['lait'], t: ['produit_laitier', 'creme'], nut: n(292, 2.4, 3, 30, 0, 3, 0.1), shelfLifeDays: 10 }),
  ing('creme_liquide', 'Crème liquide', 'cremerie', 'ml', { aliases: ['creme liquide', 'creme entiere'], density: 1, packages: [200, 500], price: 5, a: ['lait'], t: ['produit_laitier', 'creme'], nut: n(290, 2.2, 3, 30, 0, 3, 0.1), shelfLifeDays: 10 }),
  ing('yaourt_nature', 'Yaourt nature', 'cremerie', 'g', { plural: 'Yaourts nature', aliases: ['yaourt', 'yogourt'], pieceGrams: 125, packages: [500, 1000], price: 2.5, a: ['lait'], t: ['produit_laitier'], nut: n(60, 4, 5, 3, 0, 5, 0.1), shelfLifeDays: 14 }),
  ing('fromage_blanc', 'Fromage blanc', 'cremerie', 'g', { packages: [500, 1000], price: 3, a: ['lait'], t: ['produit_laitier'], nut: n(75, 7.5, 4, 3, 0, 4, 0.1), shelfLifeDays: 10 }),
  ing('emmental_rape', 'Emmental râpé', 'cremerie', 'g', { aliases: ['emmental', 'gruyere', 'fromage rape'], packages: [200], price: 10, a: ['lait'], t: ['produit_laitier', 'fromage'], nut: n(380, 28, 0, 30, 0, 0, 0.7), shelfLifeDays: 20 }),
  ing('parmesan', 'Parmesan', 'cremerie', 'g', { packages: [100, 200], price: 25, a: ['lait'], t: ['produit_laitier', 'fromage'], nut: n(400, 33, 0, 29, 0, 0, 1.6), shelfLifeDays: 30 }),
  ing('comte', 'Comté', 'cremerie', 'g', { packages: [200], price: 20, a: ['lait'], t: ['produit_laitier', 'fromage'], nut: n(410, 28, 0, 33, 0, 0, 0.8), shelfLifeDays: 30 }),
  ing('mozzarella', 'Mozzarella', 'cremerie', 'g', { pieceGrams: 125, packages: [125, 250], price: 9, a: ['lait'], t: ['produit_laitier', 'fromage'], nut: n(250, 18, 1, 19, 0, 1, 0.5), shelfLifeDays: 7 }),
  ing('feta', 'Feta', 'cremerie', 'g', { packages: [200], price: 12, a: ['lait'], t: ['produit_laitier', 'fromage'], nut: n(265, 14, 1, 22, 0, 1, 2.8), shelfLifeDays: 14 }),
  ing('chevre', 'Bûche de chèvre', 'cremerie', 'g', { aliases: ['chevre', 'fromage de chevre'], packages: [180], price: 14, a: ['lait'], t: ['produit_laitier', 'fromage'], nut: n(300, 19, 1, 24, 0, 1, 1.5), shelfLifeDays: 14 }),
  ing('tofu_ferme', 'Tofu ferme', 'cremerie', 'g', { aliases: ['tofu'], packages: [200, 400], price: 10, a: ['soja'], t: ['proteine_vegetale'], nut: n(140, 14, 2, 8, 1, 0.5, 0.05), shelfLifeDays: 10 }),
  ing('tofu_fume', 'Tofu fumé', 'cremerie', 'g', { packages: [200], price: 13, a: ['soja'], t: ['proteine_vegetale'], nut: n(160, 16, 2, 9, 1, 0.5, 0.8), shelfLifeDays: 14 }),
  ing('yaourt_soja', 'Yaourt au soja', 'cremerie', 'g', { pieceGrams: 125, packages: [500], price: 5, a: ['soja'], t: ['proteine_vegetale'], nut: n(50, 4, 2.5, 2.3, 1, 0.5, 0.1), shelfLifeDays: 14 }),
  ing('pate_feuilletee', 'Pâte feuilletée', 'cremerie', 'g', { pieceGrams: 230, packages: [230], price: 7, a: ['gluten', 'lait'], nut: n(400, 6, 38, 25, 2, 1, 1), shelfLifeDays: 14 }),
  ing('pate_brisee', 'Pâte brisée', 'cremerie', 'g', { pieceGrams: 230, packages: [230], price: 6, a: ['gluten', 'lait'], nut: n(420, 6, 45, 24, 2, 1, 1), shelfLifeDays: 14 }),
  ing('pate_pizza', 'Pâte à pizza', 'cremerie', 'g', { pieceGrams: 260, packages: [260, 400], price: 6, a: ['gluten'], nut: n(280, 8, 50, 5, 2, 2, 1.2), shelfLifeDays: 14 }),

  // --- Epicerie salee -----------------------------------------------------------------------
  ing('pates', 'Pâtes', 'epicerie_salee', 'g', { aliases: ['pates', 'spaghetti', 'penne', 'tagliatelles', 'fusilli', 'macaroni', 'coquillettes'], packages: [500, 1000], price: 2, a: ['gluten'], t: ['feculent'], nut: n(355, 12, 71, 1.5, 3, 3, 0), shelfLifeDays: 365 }),
  ing('pates_completes', 'Pâtes complètes', 'epicerie_salee', 'g', { packages: [500], price: 3, a: ['gluten'], t: ['feculent', 'cereale_complete'], nut: n(350, 13, 64, 2.5, 8, 3, 0), shelfLifeDays: 365 }),
  ing('pates_lentilles', 'Pâtes de lentilles corail', 'epicerie_salee', 'g', { packages: [250], price: 10, t: ['feculent', 'legumineuse', 'proteine_vegetale'], nut: n(340, 25, 50, 2, 8, 2, 0), shelfLifeDays: 365 }),
  ing('pates_sans_gluten', 'Pâtes sans gluten', 'epicerie_salee', 'g', { packages: [500], price: 4, t: ['feculent'], nut: n(355, 7, 78, 1.5, 2, 1, 0), shelfLifeDays: 365 }),
  ing('riz', 'Riz', 'epicerie_salee', 'g', { aliases: ['riz basmati', 'riz thai', 'riz long'], packages: [500, 1000], price: 2.5, t: ['feculent'], nut: n(350, 7, 78, 0.6, 1.3, 0.2, 0), shelfLifeDays: 365 }),
  ing('riz_risotto', 'Riz à risotto (arborio)', 'epicerie_salee', 'g', { aliases: ['arborio', 'riz rond'], packages: [500, 1000], price: 4, t: ['feculent'], nut: n(350, 7, 79, 0.6, 1, 0.2, 0), shelfLifeDays: 365 }),
  ing('quinoa', 'Quinoa', 'epicerie_salee', 'g', { packages: [500], price: 8, t: ['feculent', 'cereale_complete'], nut: n(370, 14, 64, 6, 7, 2, 0), shelfLifeDays: 365 }),
  ing('boulgour', 'Boulgour', 'epicerie_salee', 'g', { packages: [500], price: 3, a: ['gluten'], t: ['feculent', 'cereale_complete'], nut: n(350, 12, 70, 1.5, 8, 0.5, 0), shelfLifeDays: 365 }),
  ing('semoule', 'Semoule de blé', 'epicerie_salee', 'g', { aliases: ['semoule', 'couscous'], packages: [500, 1000], price: 2, a: ['gluten'], t: ['feculent'], nut: n(360, 12, 73, 1.5, 4, 1, 0), shelfLifeDays: 365 }),
  ing('lentilles_vertes', 'Lentilles vertes', 'epicerie_salee', 'g', { aliases: ['lentilles'], packages: [500], price: 4, t: ['legumineuse', 'proteine_vegetale'], nut: n(320, 24, 46, 1.5, 17, 2, 0), shelfLifeDays: 365 }),
  ing('lentilles_corail', 'Lentilles corail', 'epicerie_salee', 'g', { packages: [500], price: 5, t: ['legumineuse', 'proteine_vegetale'], nut: n(340, 24, 50, 1.5, 10, 2, 0), shelfLifeDays: 365 }),
  ing('lentilles_boite', 'Lentilles cuites (boîte)', 'epicerie_salee', 'g', { packages: [265], price: 5, t: ['legumineuse', 'proteine_vegetale'], nut: n(110, 8, 15, 0.5, 5, 0.5, 0.5), shelfLifeDays: 365 }),
  ing('pois_chiches', 'Pois chiches (boîte)', 'epicerie_salee', 'g', { aliases: ['pois chiches', 'pois chiche'], packages: [265], price: 4.5, t: ['legumineuse', 'proteine_vegetale'], nut: n(130, 7, 16, 2.5, 6, 0.5, 0.5), shelfLifeDays: 365 }),
  ing('haricots_rouges', 'Haricots rouges (boîte)', 'epicerie_salee', 'g', { aliases: ['haricots rouges'], packages: [250], price: 4, t: ['legumineuse', 'proteine_vegetale'], nut: n(110, 7.5, 14, 0.6, 6, 0.5, 0.5), shelfLifeDays: 365 }),
  ing('haricots_blancs', 'Haricots blancs (boîte)', 'epicerie_salee', 'g', { aliases: ['haricots blancs'], packages: [265], price: 4, t: ['legumineuse', 'proteine_vegetale'], nut: n(105, 7, 14, 0.5, 6, 0.5, 0.5), shelfLifeDays: 365 }),
  ing('mais', 'Maïs doux (boîte)', 'epicerie_salee', 'g', { aliases: ['mais'], packages: [285], price: 4, t: ['legume', 'feculent'], nut: n(90, 3, 16, 1.5, 3, 4, 0.4), shelfLifeDays: 365 }),
  ing('thon_boite', 'Thon au naturel (boîte)', 'epicerie_salee', 'g', { aliases: ['thon'], packages: [140], price: 15, a: ['poisson'], t: ['poisson'], nut: n(116, 26, 0, 1, 0, 0, 0.9), shelfLifeDays: 365 }),
  ing('sardines_boite', 'Sardines (boîte)', 'epicerie_salee', 'g', { aliases: ['sardines'], packages: [115], price: 12, a: ['poisson'], t: ['poisson'], nut: n(200, 24, 0, 11, 0, 0, 0.8), shelfLifeDays: 365 }),
  ing('lait_coco', 'Lait de coco', 'epicerie_salee', 'ml', { density: 1, packages: [400], price: 6, nut: n(180, 1.6, 3, 18, 0, 2, 0.05), shelfLifeDays: 365 }),
  ing('tomates_concassees', 'Tomates concassées (boîte)', 'epicerie_salee', 'g', { aliases: ['tomates concassees', 'tomates pelees'], packages: [400], price: 3, t: ['legume'], nut: n(25, 1.2, 4, 0.2, 1.2, 3.5, 0.3), shelfLifeDays: 365 }),
  ing('passata', 'Coulis de tomate', 'epicerie_salee', 'g', { aliases: ['coulis de tomate', 'passata', 'sauce tomate'], density: 1, packages: [500], price: 3, t: ['legume'], nut: n(30, 1.4, 5, 0.2, 1.3, 4, 0.3), shelfLifeDays: 365 }),
  ing('concentre_tomate', 'Concentré de tomate', 'epicerie_salee', 'g', { density: 1.1, packages: [140], price: 8, t: ['legume'], nut: n(80, 4, 13, 0.5, 4, 10, 0.2), shelfLifeDays: 365 }),
  ing('creme_soja', 'Crème de soja', 'epicerie_salee', 'ml', { density: 1, packages: [200], price: 8, a: ['soja'], nut: n(180, 2.5, 3, 17, 0.5, 1, 0.05), shelfLifeDays: 180 }),
  ing('boisson_soja', 'Boisson au soja', 'epicerie_salee', 'ml', { aliases: ['lait de soja'], density: 1, packages: [1000], price: 1.8, a: ['soja'], t: ['proteine_vegetale'], nut: n(40, 3.5, 2, 1.8, 0.5, 1, 0.1), shelfLifeDays: 180 }),
  ing('boisson_avoine', 'Boisson à l’avoine', 'epicerie_salee', 'ml', { aliases: ['lait d avoine'], density: 1, packages: [1000], price: 2, a: ['gluten'], nut: n(45, 1, 7, 1.5, 0.8, 4, 0.1), shelfLifeDays: 180 }),
  ing('bouillon_legumes', 'Bouillon de légumes (cube)', 'epicerie_salee', 'piece', { plural: 'Cubes de bouillon de légumes', pieceGrams: 10, packages: [10], price: 0.2, a: ['celeri'], nut: n(250, 10, 20, 15, 1, 5, 45), shelfLifeDays: 365 }),
  ing('bouillon_volaille', 'Bouillon de volaille (cube)', 'epicerie_salee', 'piece', { plural: 'Cubes de bouillon de volaille', pieceGrams: 10, packages: [10], price: 0.2, a: ['celeri'], t: ['origine_animale'], nut: n(250, 12, 18, 15, 0.5, 4, 45), shelfLifeDays: 365 }),
  ing('bouillon_boeuf', 'Bouillon de bœuf (cube)', 'epicerie_salee', 'piece', { plural: 'Cubes de bouillon de bœuf', pieceGrams: 10, packages: [10], price: 0.2, a: ['celeri'], t: ['origine_animale'], nut: n(250, 12, 18, 15, 0.5, 4, 45), shelfLifeDays: 365 }),
  ing('farine', 'Farine de blé', 'epicerie_salee', 'g', { aliases: ['farine'], density: 0.6, packages: [1000], price: 1.2, a: ['gluten'], nut: n(345, 10, 72, 1.2, 3, 1, 0), shelfLifeDays: 365 }),
  ing('farine_riz', 'Farine de riz', 'epicerie_salee', 'g', { density: 0.6, packages: [500], price: 4, nut: n(360, 6, 80, 1.4, 2, 0.1, 0), shelfLifeDays: 365 }),
  ing('maizena', 'Fécule de maïs', 'epicerie_salee', 'g', { aliases: ['maizena'], density: 0.6, packages: [400], price: 5, nut: n(350, 0.3, 86, 0.1, 1, 0, 0), shelfLifeDays: 365 }),
  ing('chapelure', 'Chapelure', 'epicerie_salee', 'g', { density: 0.45, packages: [250], price: 5, a: ['gluten'], nut: n(370, 12, 72, 3, 4, 4, 1.5), shelfLifeDays: 180 }),
  ing('flocons_avoine', 'Flocons d’avoine', 'epicerie_salee', 'g', { aliases: ['flocons d avoine', 'avoine'], density: 0.4, packages: [500], price: 3, a: ['gluten'], t: ['cereale_complete', 'feculent'], nut: n(370, 13, 59, 7, 10, 1, 0), shelfLifeDays: 365 }),
  ing('tortillas', 'Tortillas de blé', 'epicerie_salee', 'piece', { plural: 'Tortillas', aliases: ['wraps', 'tortilla'], pieceGrams: 60, packages: [6, 8], price: 0.3, a: ['gluten'], nut: n(310, 8, 52, 7, 2, 2, 1.1), shelfLifeDays: 30 }),
  ing('olives_noires', 'Olives noires', 'epicerie_salee', 'g', { aliases: ['olives'], packages: [150], price: 12, nut: n(180, 1.5, 3, 18, 3, 0, 3), shelfLifeDays: 365 }),
  ing('pesto', 'Pesto (bocal)', 'epicerie_salee', 'g', { aliases: ['pesto'], packages: [190], price: 15, a: ['lait', 'fruits_a_coque'], nut: n(450, 5, 6, 45, 2, 2, 2.5), shelfLifeDays: 180 }),
  ing('amandes', 'Amandes', 'epicerie_salee', 'g', { packages: [125], price: 18, a: ['fruits_a_coque'], nut: n(600, 25, 7, 52, 12, 4, 0), shelfLifeDays: 180 }),
  ing('noix', 'Cerneaux de noix', 'epicerie_salee', 'g', { aliases: ['noix'], packages: [125], price: 25, a: ['fruits_a_coque'], nut: n(700, 15, 7, 65, 6, 3, 0), shelfLifeDays: 180 }),
  // Les pignons ne font pas partie des "fruits a coque" de la liste reglementaire UE.
  ing('pignons', 'Pignons de pin', 'epicerie_salee', 'g', { aliases: ['pignons'], packages: [100], price: 60, nut: n(670, 14, 4, 68, 4, 3.6, 0), shelfLifeDays: 180 }),
  ing('graines_tournesol', 'Graines de tournesol', 'epicerie_salee', 'g', { packages: [250], price: 8, nut: n(600, 21, 12, 51, 9, 2.6, 0), shelfLifeDays: 180 }),
  ing('beurre_cacahuete', 'Beurre de cacahuète', 'epicerie_salee', 'g', { density: 1.1, packages: [350], price: 9, a: ['arachides'], nut: n(600, 25, 15, 50, 7, 6, 0.8), shelfLifeDays: 180 }),
  ing('puree_amande', 'Purée d’amande', 'epicerie_salee', 'g', { density: 1.1, packages: [250], price: 30, a: ['fruits_a_coque'], nut: n(630, 24, 6, 55, 10, 4, 0), shelfLifeDays: 180 }),
  ing('sauce_soja', 'Sauce soja', 'condiments', 'ml', { density: 1.15, packages: [250], price: 8, a: ['soja', 'gluten'], nut: n(60, 8, 6, 0, 0, 1, 15), shelfLifeDays: 365 }),
  ing('tamari', 'Tamari (sauce soja sans gluten)', 'condiments', 'ml', { density: 1.15, packages: [250], price: 15, a: ['soja'], nut: n(65, 10, 5, 0, 0, 1, 15), shelfLifeDays: 365 }),
  ing('moutarde', 'Moutarde', 'condiments', 'g', { density: 1.1, packages: [200], price: 5, a: ['moutarde'], nut: n(150, 7, 5, 11, 3, 2, 6), shelfLifeDays: 180 }),
  ing('levure_maltee', 'Levure maltée', 'epicerie_salee', 'g', { density: 0.3, packages: [125], price: 30, nut: n(370, 45, 30, 5, 20, 5, 0.1), shelfLifeDays: 365 }),

  // --- Huiles, epices, placard (staple : on suppose qu'on en a, a verifier) ---------------
  ing('huile_olive', 'Huile d’olive', 'condiments', 'ml', { aliases: ['huile d olive', 'huile'], density: 0.92, packages: [500, 1000], price: 10, t: ['matiere_grasse'], nut: n(900, 0, 0, 100, 0), staple: true, shelfLifeDays: 365 }),
  ing('huile_tournesol', 'Huile de tournesol', 'condiments', 'ml', { aliases: ['huile neutre'], density: 0.92, packages: [1000], price: 3, t: ['matiere_grasse'], nut: n(900, 0, 0, 100, 0), staple: true, shelfLifeDays: 365 }),
  ing('vinaigre_balsamique', 'Vinaigre balsamique', 'condiments', 'ml', { density: 1.05, packages: [250], price: 8, a: ['sulfites'], nut: n(90, 0.5, 17, 0, 0, 15, 0), staple: true, shelfLifeDays: 365 }),
  ing('vinaigre_vin', 'Vinaigre de vin', 'condiments', 'ml', { aliases: ['vinaigre'], density: 1, packages: [500], price: 2, a: ['sulfites'], nut: n(20, 0, 0.5, 0, 0), staple: true, shelfLifeDays: 365 }),
  ing('sel', 'Sel', 'condiments', 'g', { density: 1.2, price: 0.6, nut: n(0, 0, 0, 0, 0, 0, 100), staple: true }),
  ing('poivre', 'Poivre', 'condiments', 'g', { density: 0.5, price: 30, t: ['herbe_epice'], nut: n(250, 10, 40, 3, 25), staple: true }),
  ing('cumin', 'Cumin', 'condiments', 'g', { density: 0.5, price: 30, t: ['herbe_epice'], nut: n(375, 18, 44, 22, 10), staple: true }),
  ing('paprika', 'Paprika', 'condiments', 'g', { aliases: ['paprika fume'], density: 0.5, price: 30, t: ['herbe_epice'], nut: n(280, 14, 25, 13, 35), staple: true }),
  ing('curry', 'Curry en poudre', 'condiments', 'g', { aliases: ['curry'], density: 0.5, price: 30, t: ['herbe_epice'], nut: n(325, 14, 25, 14, 33), staple: true }),
  ing('curcuma', 'Curcuma', 'condiments', 'g', { density: 0.5, price: 30, t: ['herbe_epice'], nut: n(310, 10, 44, 3, 21), staple: true }),
  ing('herbes_provence', 'Herbes de Provence', 'condiments', 'g', { aliases: ['herbes de provence', 'thym', 'origan'], density: 0.3, price: 40, t: ['herbe_epice'], nut: n(270, 9, 30, 7, 37), staple: true }),
  ing('cannelle', 'Cannelle', 'condiments', 'g', { density: 0.5, price: 35, t: ['herbe_epice'], nut: n(250, 4, 27, 1.2, 53), staple: true }),
  ing('piment', 'Piment (en poudre)', 'condiments', 'g', { aliases: ['piment', 'piment d espelette'], density: 0.5, price: 60, t: ['herbe_epice'], nut: n(280, 12, 25, 14, 35), staple: true }),
  ing('muscade', 'Noix de muscade', 'condiments', 'g', { aliases: ['muscade'], density: 0.5, price: 50, t: ['herbe_epice'], nut: n(525, 6, 28, 36, 21), staple: true }),
  ing('laurier', 'Laurier', 'condiments', 'g', { pieceGrams: 0.5, price: 50, t: ['herbe_epice'], nut: n(310, 8, 48, 8, 26), staple: true }),

  // --- Epicerie sucree ----------------------------------------------------------------------
  ing('sucre', 'Sucre', 'epicerie_sucree', 'g', { density: 0.85, packages: [1000], price: 1.2, t: ['sucre_ajoute'], nut: n(400, 0, 100, 0, 0, 100, 0), shelfLifeDays: 365 }),
  ing('miel', 'Miel', 'epicerie_sucree', 'g', { density: 1.4, packages: [250, 500], price: 12, t: ['miel', 'sucre_ajoute'], nut: n(320, 0.4, 80, 0, 0, 80, 0), shelfLifeDays: 365 }),
  ing('sirop_erable', 'Sirop d’érable', 'epicerie_sucree', 'ml', { density: 1.33, packages: [250], price: 30, t: ['sucre_ajoute'], nut: n(260, 0, 67, 0, 0, 60, 0), shelfLifeDays: 365 }),
  ing('chocolat_noir', 'Chocolat noir', 'epicerie_sucree', 'g', { aliases: ['chocolat'], packages: [100, 200], price: 15, a: ['soja', 'lait'], t: ['sucre_ajoute'], nut: n(550, 7, 35, 40, 10, 30, 0), shelfLifeDays: 365 }),
  ing('cacao', 'Cacao en poudre non sucré', 'epicerie_sucree', 'g', { aliases: ['cacao'], density: 0.5, packages: [250], price: 20, nut: n(380, 20, 15, 22, 30, 1, 0.1), shelfLifeDays: 365 }),
  ing('levure_chimique', 'Levure chimique', 'epicerie_sucree', 'g', { unitSizes: { sachet: 11 }, packages: [66], price: 14, nut: n(100, 0, 25, 0, 0, 0, 25), shelfLifeDays: 365 }),

  // --- Boulangerie --------------------------------------------------------------------------
  ing('pain', 'Baguette', 'boulangerie', 'g', { aliases: ['pain', 'baguette'], pieceGrams: 250, unitSizes: { tranche: 30 }, price: 4.4, a: ['gluten'], nut: n(270, 9, 56, 1.5, 3, 2, 1.2), shelfLifeDays: 1 }),
  ing('pain_complet', 'Pain de mie complet', 'boulangerie', 'g', { aliases: ['pain complet', 'pain de mie'], unitSizes: { tranche: 25 }, packages: [500], price: 5, a: ['gluten'], t: ['cereale_complete'], nut: n(250, 9, 44, 4, 7, 4, 1.1), shelfLifeDays: 7 }),
  ing('pain_sans_gluten', 'Pain sans gluten', 'boulangerie', 'g', { unitSizes: { tranche: 30 }, packages: [300], price: 12, nut: n(260, 4, 45, 7, 5, 3, 1.1), shelfLifeDays: 7 }),
  ing('pain_burger', 'Pain à burger', 'boulangerie', 'piece', { plural: 'Pains à burger', pieceGrams: 60, packages: [4, 6], price: 0.4, a: ['gluten', 'sesame'], nut: n(270, 9, 48, 4, 2, 6, 1.1), shelfLifeDays: 7 }),

  // --- Surgeles -----------------------------------------------------------------------------
  ing('haricots_verts_surgeles', 'Haricots verts surgelés', 'surgeles', 'g', { packages: [1000], price: 3, t: ['legume'], nut: n(28, 1.8, 3.5, 0.2, 3, 1.5), shelfLifeDays: 180 }),
  ing('epinards_surgeles', 'Épinards surgelés', 'surgeles', 'g', { packages: [750], price: 3, t: ['legume'], nut: n(25, 3, 1, 0.5, 2.5, 0.4, 0.2), shelfLifeDays: 180 }),
  ing('petits_pois', 'Petits pois surgelés', 'surgeles', 'g', { aliases: ['petits pois'], packages: [1000], price: 3.5, t: ['legume'], nut: n(81, 5.4, 10, 0.4, 5.5, 4), shelfLifeDays: 180 }),
  ing('poelee_legumes', 'Poêlée de légumes surgelée', 'surgeles', 'g', { packages: [750], price: 3.5, t: ['legume'], nut: n(40, 1.8, 5, 1, 3, 3, 0.3), shelfLifeDays: 180 }),
  ing('fruits_rouges', 'Fruits rouges surgelés', 'surgeles', 'g', { aliases: ['fruits rouges', 'framboises', 'myrtilles'], packages: [500], price: 8, t: ['fruit'], nut: n(45, 1, 8, 0.3, 5, 6), shelfLifeDays: 180 }),
  ing('colin_surgele', 'Filets de colin surgelés', 'surgeles', 'g', { aliases: ['colin', 'lieu'], packages: [400], price: 12, a: ['poisson'], t: ['poisson'], nut: n(80, 18, 0, 0.9, 0, 0, 0.3), shelfLifeDays: 180 }),
]

