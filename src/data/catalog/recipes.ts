import type { Recipe, RecipeIngredient, Unit } from '@/domain/types'

// Recettes de depart redigees pour Mijote (classiques de la cuisine familiale). Quantites testees
// sur des proportions courantes ; cout, nutrition, allergenes et regimes ne sont PAS saisis ici :
// ils sont calcules a partir du referentiel (src/domain/analysis.ts), donc toujours coherents.

const i = (ingredientId: string, quantity: number, unit: Unit = 'g', extra: Partial<RecipeIngredient> = {}): RecipeIngredient => ({ ingredientId, quantity, unit, ...extra })
const taste = (ingredientId: string): RecipeIngredient => ({ ingredientId, quantity: null, unit: 'pincee' })
const opt = (ingredientId: string, quantity: number, unit: Unit = 'g'): RecipeIngredient => ({ ingredientId, quantity, unit, optional: true })

type Def = Omit<Recipe, 'source' | 'storage' | 'equipment' | 'tags'> & Partial<Pick<Recipe, 'storage' | 'equipment' | 'tags'>>
const MAIN: Recipe['slots'] = ['dejeuner', 'diner']

function r(def: Def): Recipe {
  return {
    equipment: ['plaque'],
    tags: [],
    storage: { fridgeDays: 2, freezable: false },
    ...def,
    source: { kind: 'mijote', label: 'Recette Mijote' },
  }
}

export const RECIPES: Recipe[] = [
  // --- Petits-dejeuners ---------------------------------------------------------------------
  r({
    id: 'porridge-pomme-cannelle', name: 'Porridge pomme-cannelle', emoji: '🥣', description: 'Un bol chaud et rassasiant, prêt en 10 minutes.',
    servings: 2, prepMinutes: 3, cookMinutes: 7, difficulty: 1, slots: ['petit_dejeuner'], course: 'petit_dejeuner', cuisine: 'française',
    ingredients: [i('flocons_avoine', 100), i('lait', 400, 'ml'), i('pomme', 1, 'piece'), i('cannelle', 0.5, 'cac'), opt('miel', 1, 'cas')],
    steps: ['Couper la pomme en petits dés.', 'Porter le lait à frémissement avec les flocons et la pomme.', 'Cuire 5 à 7 minutes en remuant jusqu’à épaississement.', 'Saupoudrer de cannelle, sucrer au miel si besoin.'],
    tags: ['rapide', 'reconfortant', 'economique'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'overnight-oats-fruits-rouges', name: 'Overnight oats aux fruits rouges', emoji: '🫐', description: 'À préparer la veille : le matin, il n’y a plus qu’à le sortir du frigo.',
    servings: 2, prepMinutes: 5, cookMinutes: 0, difficulty: 1, slots: ['petit_dejeuner'], course: 'petit_dejeuner', equipment: [],
    ingredients: [i('flocons_avoine', 80), i('yaourt_nature', 250), i('lait', 150, 'ml'), i('fruits_rouges', 150), opt('miel', 2, 'cac')],
    steps: ['Mélanger flocons, yaourt et lait dans deux bocaux.', 'Ajouter les fruits rouges encore surgelés par-dessus.', 'Fermer et laisser au frigo toute la nuit.', 'Sucrer au miel au moment de servir si besoin.'],
    tags: ['rapide', 'sans_cuisson', 'batch'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'oeufs-brouilles-tartines', name: 'Œufs brouillés et tartines', emoji: '🍳', description: 'Des œufs crémeux à la ciboulette sur pain complet grillé.',
    servings: 2, prepMinutes: 3, cookMinutes: 5, difficulty: 1, slots: ['petit_dejeuner', 'dejeuner', 'diner'], course: 'petit_dejeuner', cuisine: 'française',
    ingredients: [i('oeuf', 4, 'piece'), i('beurre', 10), i('pain_complet', 4, 'tranche'), opt('ciboulette', 5), taste('sel'), taste('poivre')],
    steps: ['Battre les œufs avec sel et poivre.', 'Faire fondre le beurre à feu doux, verser les œufs.', 'Remuer sans cesse avec une spatule jusqu’à une texture crémeuse.', 'Servir sur les tartines grillées, parsemer de ciboulette.'],
    tags: ['rapide'], storage: { fridgeDays: 0, freezable: false },
  }),
  r({
    id: 'pancakes-banane', name: 'Pancakes à la banane', emoji: '🥞', description: 'Moelleux, peu sucrés, parfaits pour utiliser des bananes bien mûres.',
    servings: 2, prepMinutes: 10, cookMinutes: 10, difficulty: 1, slots: ['petit_dejeuner', 'collation'], course: 'petit_dejeuner',
    ingredients: [i('banane', 2, 'piece'), i('oeuf', 2, 'piece'), i('farine', 80), i('lait', 100, 'ml'), i('levure_chimique', 0.5, 'sachet'), i('huile_tournesol', 1, 'cac')],
    steps: ['Écraser les bananes à la fourchette.', 'Ajouter les œufs, puis la farine, la levure et le lait ; mélanger.', 'Huiler légèrement une poêle chaude, verser de petites louches de pâte.', 'Cuire 2 minutes par face jusqu’à ce que des bulles apparaissent.'],
    tags: ['anti_gaspi', 'gourmand', 'enfants'], storage: { fridgeDays: 2, freezable: true },
  }),
  r({
    id: 'bol-fromage-blanc', name: 'Bol fromage blanc, fruits et amandes', emoji: '🥛', description: 'Riche en protéines, sans cuisson, en 3 minutes.',
    servings: 1, prepMinutes: 3, cookMinutes: 0, difficulty: 1, slots: ['petit_dejeuner', 'collation'], course: 'petit_dejeuner', equipment: [],
    ingredients: [i('fromage_blanc', 200), i('fruits_rouges', 80), i('amandes', 15), opt('miel', 1, 'cac')],
    steps: ['Verser le fromage blanc dans un bol.', 'Ajouter les fruits (décongelés quelques minutes) et les amandes concassées.', 'Un filet de miel si besoin.'],
    tags: ['rapide', 'sans_cuisson', 'leger'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'tartines-avocat-oeuf', name: 'Tartines avocat et œuf mollet', emoji: '🥑', description: 'Un brunch rapide, croquant et fondant.',
    servings: 2, prepMinutes: 5, cookMinutes: 6, difficulty: 1, slots: ['petit_dejeuner', 'dejeuner'], course: 'petit_dejeuner',
    ingredients: [i('pain_complet', 4, 'tranche'), i('avocat', 1, 'piece'), i('oeuf', 2, 'piece'), i('citron', 0.5, 'piece'), taste('sel'), opt('piment', 1, 'pincee')],
    steps: ['Cuire les œufs 6 minutes dans l’eau bouillante, les passer sous l’eau froide et les écaler.', 'Écraser l’avocat avec le jus de citron, saler.', 'Griller le pain, tartiner d’avocat.', 'Poser un œuf coupé en deux sur chaque paire de tartines, pimenter.'],
    tags: ['rapide'], storage: { fridgeDays: 0, freezable: false },
  }),

  // --- Desserts et collations ---------------------------------------------------------------
  r({
    id: 'compote-pommes-poires', name: 'Compote pommes-poires', emoji: '🍐', description: 'Idéale pour les fruits un peu fatigués, sans sucre ajouté.',
    servings: 4, prepMinutes: 10, cookMinutes: 20, difficulty: 1, slots: ['collation', 'petit_dejeuner'], course: 'dessert',
    ingredients: [i('pomme', 4, 'piece'), i('poire', 2, 'piece'), i('cannelle', 0.5, 'cac')],
    steps: ['Éplucher et couper les fruits en morceaux.', 'Cuire à couvert avec 5 cl d’eau et la cannelle pendant 20 minutes.', 'Écraser à la fourchette ou mixer selon la texture voulue.'],
    tags: ['anti_gaspi', 'economique', 'batch', 'leger', 'enfants'], storage: { fridgeDays: 5, freezable: true },
  }),
  r({
    id: 'gateau-yaourt', name: 'Gâteau au yaourt', emoji: '🍰', description: 'Le classique qu’on mesure avec le pot de yaourt.',
    servings: 8, prepMinutes: 10, cookMinutes: 35, difficulty: 1, slots: ['collation'], course: 'dessert', equipment: ['four'],
    ingredients: [i('yaourt_nature', 125), i('sucre', 150), i('farine', 200), i('oeuf', 3, 'piece'), i('huile_tournesol', 80, 'ml'), i('levure_chimique', 1, 'sachet')],
    steps: ['Préchauffer le four à 180 °C.', 'Mélanger le yaourt, le sucre et les œufs.', 'Ajouter la farine et la levure, puis l’huile.', 'Verser dans un moule beurré et cuire 35 minutes (la lame doit ressortir sèche).'],
    tags: ['gourmand', 'enfants', 'economique'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'mousse-chocolat', name: 'Mousse au chocolat', emoji: '🍫', description: 'Deux ingrédients, un résultat aérien.',
    servings: 4, prepMinutes: 20, cookMinutes: 0, difficulty: 2, slots: ['collation'], course: 'dessert',
    ingredients: [i('chocolat_noir', 150), i('oeuf', 4, 'piece'), taste('sel')],
    steps: ['Faire fondre le chocolat au bain-marie, laisser tiédir.', 'Séparer les blancs des jaunes ; incorporer les jaunes au chocolat.', 'Monter les blancs en neige ferme avec une pincée de sel.', 'Incorporer délicatement les blancs au chocolat, puis réserver 3 heures au frais.'],
    tags: ['gourmand'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'crumble-pommes', name: 'Crumble aux pommes', emoji: '🍎', description: 'Pommes fondantes et pâte sablée croustillante.',
    servings: 6, prepMinutes: 15, cookMinutes: 30, difficulty: 1, slots: ['collation'], course: 'dessert', equipment: ['four'],
    ingredients: [i('pomme', 6, 'piece'), i('farine', 150), i('beurre', 100), i('sucre', 100), i('cannelle', 1, 'cac')],
    steps: ['Préchauffer le four à 190 °C.', 'Couper les pommes en dés dans un plat, saupoudrer de cannelle.', 'Sabler du bout des doigts la farine, le sucre et le beurre froid en dés.', 'Répartir sur les pommes et cuire 30 minutes jusqu’à ce que le dessus soit doré.'],
    tags: ['gourmand', 'reconfortant', 'anti_gaspi'], storage: { fridgeDays: 3, freezable: true },
  }),
  r({
    id: 'energy-balls', name: 'Energy balls cacahuète-chocolat', emoji: '🟤', description: 'Un en-cas maison qui se garde toute la semaine.',
    servings: 6, prepMinutes: 15, cookMinutes: 0, difficulty: 1, slots: ['collation'], course: 'collation', equipment: [],
    ingredients: [i('flocons_avoine', 120), i('beurre_cacahuete', 90), i('miel', 50), i('chocolat_noir', 40)],
    steps: ['Hacher grossièrement le chocolat.', 'Mélanger tous les ingrédients dans un saladier.', 'Former des boules de la taille d’une noix avec les mains humides.', 'Réserver 30 minutes au frais avant de déguster.'],
    tags: ['batch', 'sans_cuisson'], storage: { fridgeDays: 7, freezable: true },
  }),
  r({
    id: 'banana-bread', name: 'Banana bread', emoji: '🍌', description: 'Le meilleur sort pour les bananes trop mûres.',
    servings: 8, prepMinutes: 15, cookMinutes: 50, difficulty: 1, slots: ['collation', 'petit_dejeuner'], course: 'collation', equipment: ['four'],
    ingredients: [i('banane', 3, 'piece'), i('farine', 200), i('sucre', 80), i('oeuf', 2, 'piece'), i('beurre', 80), i('levure_chimique', 1, 'sachet'), opt('noix', 50)],
    steps: ['Préchauffer le four à 180 °C.', 'Écraser les bananes, ajouter le beurre fondu, le sucre et les œufs.', 'Incorporer la farine et la levure, puis les noix concassées.', 'Verser dans un moule à cake et cuire 50 minutes.'],
    tags: ['anti_gaspi', 'gourmand', 'batch'], storage: { fridgeDays: 5, freezable: true },
  }),

  // --- Pates et riz -------------------------------------------------------------------------
  r({
    id: 'spaghetti-bolognaise', name: 'Spaghetti bolognaise', emoji: '🍝', description: 'La sauce mijotée familiale, encore meilleure le lendemain.',
    servings: 4, prepMinutes: 15, cookMinutes: 40, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'italienne',
    ingredients: [i('pates', 400), i('boeuf_hache', 400), i('tomates_concassees', 400), i('concentre_tomate', 1, 'cas'), i('oignon', 1, 'piece'), i('carotte', 1, 'piece'), i('ail', 2, 'gousse'), i('huile_olive', 2, 'cas', ), i('herbes_provence', 1, 'cac'), taste('sel'), taste('poivre'), opt('parmesan', 40)],
    steps: ['Hacher l’oignon, l’ail et la carotte ; les faire revenir 5 minutes dans l’huile.', 'Ajouter le bœuf haché et le faire dorer en l’émiettant.', 'Ajouter les tomates, le concentré et les herbes ; saler, poivrer.', 'Laisser mijoter 30 minutes à feu doux.', 'Cuire les pâtes, servir avec la sauce et le parmesan.'],
    tags: ['reconfortant', 'batch', 'enfants'], storage: { fridgeDays: 3, freezable: true },
  }),
  r({
    id: 'pates-carbonara', name: 'Pâtes carbonara', emoji: '🥓', description: 'La vraie, sans crème : œufs, parmesan et lardons.',
    servings: 4, prepMinutes: 10, cookMinutes: 12, difficulty: 2, slots: MAIN, course: 'plat', cuisine: 'italienne',
    ingredients: [i('pates', 400), i('lardons', 200), i('oeuf', 4, 'piece'), i('parmesan', 80), taste('poivre')],
    steps: ['Cuire les pâtes dans une grande casserole d’eau salée.', 'Faire dorer les lardons à sec dans une poêle.', 'Battre les œufs avec le parmesan râpé et beaucoup de poivre.', 'Hors du feu, mélanger les pâtes égouttées aux lardons, puis aux œufs, avec un peu d’eau de cuisson pour obtenir une sauce crémeuse.'],
    tags: ['rapide', 'gourmand', 'reconfortant'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'pates-pesto-courgettes', name: 'Pâtes au pesto et courgettes', emoji: '🌿', description: 'Un plat d’été frais et rapide.',
    servings: 4, prepMinutes: 10, cookMinutes: 12, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'italienne',
    ingredients: [i('pates', 350), i('courgette', 2, 'piece'), i('pesto', 100), i('huile_olive', 1, 'cas'), opt('pignons', 20), opt('parmesan', 30), taste('sel')],
    steps: ['Cuire les pâtes.', 'Couper les courgettes en demi-rondelles, les faire sauter 6 minutes à l’huile.', 'Mélanger pâtes, courgettes et pesto avec un peu d’eau de cuisson.', 'Parsemer de pignons grillés et de parmesan.'],
    tags: ['rapide', 'leger'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'pates-thon-tomate', name: 'Pâtes au thon et à la tomate', emoji: '🐟', description: 'Le plat du placard : économique et prêt en 15 minutes.',
    servings: 4, prepMinutes: 5, cookMinutes: 12, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'italienne',
    ingredients: [i('pates', 400), i('thon_boite', 280), i('tomates_concassees', 400), i('oignon', 1, 'piece'), i('ail', 1, 'gousse'), i('huile_olive', 1, 'cas'), i('herbes_provence', 1, 'cac'), taste('sel'), opt('olives_noires', 50)],
    steps: ['Faire revenir l’oignon et l’ail émincés dans l’huile.', 'Ajouter les tomates et les herbes, laisser réduire 10 minutes.', 'Pendant ce temps, cuire les pâtes.', 'Ajouter le thon émietté et les olives à la sauce, mélanger aux pâtes.'],
    tags: ['rapide', 'economique', 'enfants'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'gratin-pates-jambon', name: 'Gratin de pâtes au jambon', emoji: '🧀', description: 'Le réconfort version four, qui plaît à tout le monde.',
    servings: 4, prepMinutes: 15, cookMinutes: 25, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'française', equipment: ['plaque', 'four'],
    ingredients: [i('pates', 350), i('jambon_blanc', 4, 'tranche'), i('creme_liquide', 200, 'ml'), i('lait', 200, 'ml'), i('emmental_rape', 120), taste('muscade'), taste('sel'), taste('poivre')],
    steps: ['Préchauffer le four à 200 °C et cuire les pâtes 2 minutes de moins qu’indiqué.', 'Couper le jambon en lanières.', 'Mélanger pâtes, jambon, crème, lait, muscade, sel et poivre dans un plat.', 'Couvrir d’emmental et gratiner 20 à 25 minutes.'],
    tags: ['reconfortant', 'gourmand', 'enfants'], storage: { fridgeDays: 3, freezable: true },
  }),
  r({
    id: 'risotto-champignons', name: 'Risotto aux champignons', emoji: '🍄', description: 'Crémeux et parfumé, le plaisir de remuer.',
    servings: 4, prepMinutes: 10, cookMinutes: 25, difficulty: 2, slots: MAIN, course: 'plat', cuisine: 'italienne',
    ingredients: [i('riz_risotto', 300), i('champignon', 400), i('echalote', 2, 'piece'), i('bouillon_volaille', 2, 'piece'), i('parmesan', 60), i('beurre', 30), i('huile_olive', 1, 'cas'), taste('poivre')],
    steps: ['Dissoudre les cubes dans 1 litre d’eau chaude.', 'Faire revenir les échalotes et les champignons émincés dans l’huile.', 'Ajouter le riz, le nacrer 2 minutes, puis verser le bouillon louche par louche en remuant (18 minutes).', 'Hors du feu, ajouter le beurre et le parmesan, poivrer et servir aussitôt.'],
    tags: ['gourmand', 'reconfortant'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'pates-brocoli-parmesan', name: 'Pâtes complètes, brocoli et parmesan', emoji: '🥦', description: 'Simple, vert et rassasiant.',
    servings: 4, prepMinutes: 10, cookMinutes: 12, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'italienne',
    ingredients: [i('pates_completes', 350), i('brocoli', 1, 'piece'), i('ail', 2, 'gousse'), i('huile_olive', 3, 'cas'), i('parmesan', 50), opt('piment', 1, 'pincee'), taste('sel')],
    steps: ['Détailler le brocoli en petits bouquets.', 'Cuire les pâtes et ajouter le brocoli dans la même eau 5 minutes avant la fin.', 'Faire dorer l’ail émincé dans l’huile avec le piment.', 'Mélanger pâtes, brocoli, huile à l’ail et parmesan.'],
    tags: ['rapide', 'economique', 'leger'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'one-pot-pasta', name: 'One pot pasta tomate-épinards', emoji: '🍅', description: 'Tout cuit dans la même casserole : moins de vaisselle.',
    servings: 4, prepMinutes: 5, cookMinutes: 15, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'italienne',
    ingredients: [i('pates', 350), i('tomate_cerise', 250), i('epinards', 150), i('oignon', 1, 'piece'), i('ail', 2, 'gousse'), i('mozzarella', 1, 'piece'), i('bouillon_legumes', 1, 'piece'), i('huile_olive', 2, 'cas'), taste('sel'), taste('poivre')],
    steps: ['Mettre pâtes, tomates coupées, oignon et ail émincés dans une sauteuse.', 'Couvrir de 90 cl d’eau avec le cube émietté et l’huile.', 'Cuire 12 minutes à feu vif en remuant souvent, jusqu’à absorption.', 'Ajouter les épinards et la mozzarella en morceaux, couvrir 2 minutes.'],
    tags: ['rapide', 'leger'], storage: { fridgeDays: 2, freezable: false },
  }),

  // --- Volaille -----------------------------------------------------------------------------
  r({
    id: 'poulet-curry-coco', name: 'Poulet curry-coco', emoji: '🍛', description: 'Doux, parfumé et prêt en 30 minutes.',
    servings: 4, prepMinutes: 10, cookMinutes: 20, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'indienne',
    ingredients: [i('blanc_poulet', 500), i('lait_coco', 400, 'ml'), i('oignon', 1, 'piece'), i('ail', 2, 'gousse'), i('gingembre', 10), i('curry', 2, 'cas'), i('huile_tournesol', 1, 'cas'), i('riz', 300), opt('coriandre', 10), taste('sel')],
    steps: ['Lancer la cuisson du riz.', 'Faire revenir l’oignon, l’ail et le gingembre hachés dans l’huile.', 'Ajouter le poulet en cubes et le curry, faire dorer 5 minutes.', 'Verser le lait de coco et laisser mijoter 12 minutes.', 'Servir avec le riz et la coriandre.'],
    tags: ['reconfortant', 'batch'], storage: { fridgeDays: 3, freezable: true },
  }),
  r({
    id: 'poulet-roti-legumes', name: 'Cuisses de poulet rôties aux légumes', emoji: '🍗', description: 'Tout cuit au four sur la même plaque.',
    servings: 4, prepMinutes: 15, cookMinutes: 45, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'française', equipment: ['four'],
    ingredients: [i('cuisse_poulet', 4, 'piece'), i('pomme_de_terre', 800), i('carotte', 4, 'piece'), i('oignon_rouge', 2, 'piece'), i('ail', 4, 'gousse'), i('huile_olive', 3, 'cas'), i('herbes_provence', 2, 'cac'), taste('sel'), taste('poivre')],
    steps: ['Préchauffer le four à 210 °C.', 'Couper pommes de terre et carottes en morceaux, l’oignon en quartiers.', 'Tout mélanger sur une plaque avec l’huile, l’ail en chemise, les herbes, sel et poivre.', 'Poser les cuisses dessus et rôtir 45 minutes en retournant les légumes à mi-cuisson.'],
    tags: ['reconfortant', 'economique', 'convivial'], storage: { fridgeDays: 3, freezable: false },
  }),
  r({
    id: 'wok-poulet-legumes', name: 'Wok de poulet aux légumes', emoji: '🥢', description: 'Sauté minute, légumes croquants et sauce soja-gingembre.',
    servings: 4, prepMinutes: 15, cookMinutes: 10, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'asiatique',
    ingredients: [i('blanc_poulet', 450), i('poivron', 1, 'piece'), i('courgette', 1, 'piece'), i('carotte', 2, 'piece'), i('gingembre', 10), i('ail', 2, 'gousse'), i('sauce_soja', 4, 'cas'), i('huile_tournesol', 2, 'cas'), i('riz', 300)],
    steps: ['Cuire le riz.', 'Émincer finement les légumes et le poulet.', 'Saisir le poulet 4 minutes dans l’huile très chaude, réserver.', 'Sauter les légumes avec l’ail et le gingembre 4 minutes, remettre le poulet, ajouter la sauce soja.'],
    tags: ['rapide', 'leger'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'fajitas-poulet', name: 'Fajitas de poulet', emoji: '🌯', description: 'À garnir à table, chacun à son goût.',
    servings: 4, prepMinutes: 15, cookMinutes: 12, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'mexicaine',
    ingredients: [i('tortillas', 8, 'piece'), i('blanc_poulet', 450), i('poivron', 2, 'piece'), i('oignon_rouge', 1, 'piece'), i('paprika', 1, 'cac'), i('cumin', 1, 'cac'), i('huile_olive', 2, 'cas'), i('avocat', 1, 'piece'), i('yaourt_nature', 125), i('citron_vert', 1, 'piece'), taste('sel')],
    steps: ['Émincer poulet, poivrons et oignon.', 'Saisir le poulet avec les épices dans l’huile, ajouter les légumes et cuire 8 minutes.', 'Écraser l’avocat avec le citron vert.', 'Réchauffer les tortillas et garnir avec poulet, légumes, avocat et yaourt.'],
    tags: ['convivial', 'rapide', 'enfants'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'salade-cesar', name: 'Salade César au poulet', emoji: '🥗', description: 'Croquante, avec une sauce légère au yaourt et parmesan.',
    servings: 2, prepMinutes: 15, cookMinutes: 10, difficulty: 1, slots: MAIN, course: 'salade',
    ingredients: [i('salade_verte', 1, 'piece'), i('blanc_poulet', 250), i('pain', 2, 'tranche'), i('parmesan', 30), i('yaourt_nature', 125), i('moutarde', 1, 'cac'), i('citron', 0.5, 'piece'), i('huile_olive', 2, 'cas'), taste('sel'), taste('poivre')],
    steps: ['Cuire le poulet à la poêle 10 minutes, le trancher.', 'Couper le pain en dés et le dorer avec 1 c. à soupe d’huile.', 'Mélanger yaourt, moutarde, citron, la moitié du parmesan, sel et poivre.', 'Assembler salade, poulet, croûtons, sauce et copeaux de parmesan.'],
    tags: ['leger', 'rapide'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'wraps-poulet-crudites', name: 'Wraps poulet-crudités', emoji: '🫔', description: 'Le déjeuner à emporter, frais et rapide.',
    servings: 2, prepMinutes: 15, cookMinutes: 8, difficulty: 1, slots: ['dejeuner'], course: 'plat',
    ingredients: [i('tortillas', 4, 'piece'), i('blanc_poulet', 250), i('carotte', 1, 'piece'), i('salade_verte', 0.5, 'piece'), i('tomate', 1, 'piece'), i('fromage_blanc', 100), i('ciboulette', 5), i('paprika', 0.5, 'cac'), taste('sel')],
    steps: ['Cuire le poulet en lanières avec le paprika.', 'Râper la carotte, émincer salade et tomate.', 'Mélanger fromage blanc, ciboulette ciselée et sel.', 'Tartiner les tortillas, garnir et rouler serré.'],
    tags: ['rapide', 'leger'], storage: { fridgeDays: 1, freezable: false },
  }),

  // --- Boeuf, porc ---------------------------------------------------------------------------
  r({
    id: 'chili-con-carne', name: 'Chili con carne', emoji: '🌶️', description: 'Mijoté, épicé à votre goût, parfait en grande quantité.',
    servings: 6, prepMinutes: 15, cookMinutes: 45, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'mexicaine',
    ingredients: [i('boeuf_hache', 500), i('haricots_rouges', 500), i('tomates_concassees', 800), i('oignon', 2, 'piece'), i('poivron', 1, 'piece'), i('ail', 2, 'gousse'), i('cumin', 2, 'cac'), i('paprika', 1, 'cac'), i('piment', 0.5, 'cac'), i('huile_olive', 2, 'cas'), i('riz', 400), taste('sel')],
    steps: ['Faire revenir oignons, ail et poivron hachés dans l’huile.', 'Ajouter le bœuf et les épices, faire dorer.', 'Ajouter les tomates et laisser mijoter 30 minutes.', 'Ajouter les haricots rincés 10 minutes avant la fin ; servir avec le riz.'],
    tags: ['batch', 'reconfortant', 'convivial'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'boeuf-carottes', name: 'Bœuf carottes mijoté', emoji: '🥕', description: 'Le plat du dimanche, fondant après 2 heures de cuisson douce.',
    servings: 6, prepMinutes: 20, cookMinutes: 150, difficulty: 2, slots: MAIN, course: 'plat', cuisine: 'française',
    ingredients: [i('boeuf_braiser', 1000), i('carotte', 8, 'piece'), i('oignon', 2, 'piece'), i('bouillon_boeuf', 1, 'piece'), i('concentre_tomate', 1, 'cas'), i('farine', 1, 'cas'), i('laurier', 2, 'piece'), i('huile_tournesol', 2, 'cas'), taste('sel'), taste('poivre')],
    steps: ['Couper la viande en gros cubes et la faire dorer en plusieurs fois dans l’huile.', 'Ajouter les oignons émincés, saupoudrer de farine et mélanger 1 minute.', 'Ajouter concentré, carottes en rondelles, laurier et le cube dissous dans 75 cl d’eau.', 'Couvrir et laisser mijoter 2 h 30 à feu très doux.'],
    tags: ['reconfortant', 'batch', 'convivial'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'hachis-parmentier', name: 'Hachis parmentier', emoji: '🥔', description: 'Purée maison et viande fondante, gratinés au four.',
    servings: 6, prepMinutes: 25, cookMinutes: 40, difficulty: 2, slots: MAIN, course: 'plat', cuisine: 'française', equipment: ['plaque', 'four'],
    ingredients: [i('pomme_de_terre', 1200), i('boeuf_hache', 600), i('oignon', 2, 'piece'), i('lait', 200, 'ml'), i('beurre', 40), i('emmental_rape', 80), i('herbes_provence', 1, 'cac'), taste('muscade'), taste('sel'), taste('poivre')],
    steps: ['Cuire les pommes de terre épluchées 20 minutes à l’eau salée.', 'Faire revenir les oignons puis la viande avec les herbes.', 'Écraser les pommes de terre avec le lait chaud, le beurre et la muscade.', 'Dans un plat : viande, puis purée, puis emmental ; gratiner 20 minutes à 200 °C.'],
    tags: ['reconfortant', 'batch', 'enfants'], storage: { fridgeDays: 3, freezable: true },
  }),
  r({
    id: 'burgers-maison', name: 'Burgers maison', emoji: '🍔', description: 'Steak juteux, comté fondu et crudités.',
    servings: 4, prepMinutes: 15, cookMinutes: 10, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'américaine',
    ingredients: [i('pain_burger', 4, 'piece'), i('boeuf_hache', 500), i('comte', 80), i('tomate', 1, 'piece'), i('salade_verte', 0.25, 'piece'), i('oignon_rouge', 1, 'piece'), i('moutarde', 1, 'cas'), taste('sel'), taste('poivre')],
    steps: ['Former 4 steaks avec la viande, saler et poivrer.', 'Cuire 3 minutes par face à la poêle bien chaude, poser le comté en fin de cuisson.', 'Toaster les pains.', 'Monter : pain, moutarde, salade, steak, tomate, oignon, pain.'],
    tags: ['gourmand', 'convivial', 'enfants'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'filet-mignon-moutarde', name: 'Filet mignon sauce moutarde', emoji: '🥩', description: 'Tendre, avec une sauce crémeuse aux champignons.',
    servings: 4, prepMinutes: 10, cookMinutes: 25, difficulty: 2, slots: MAIN, course: 'plat', cuisine: 'française',
    ingredients: [i('filet_mignon_porc', 600), i('champignon', 250), i('creme_fraiche', 200, 'ml'), i('moutarde', 2, 'cas'), i('echalote', 1, 'piece'), i('haricots_verts_surgeles', 500), i('huile_olive', 1, 'cas'), taste('sel'), taste('poivre')],
    steps: ['Couper le filet mignon en médaillons et les saisir 3 minutes par face, réserver.', 'Faire revenir l’échalote et les champignons dans la même poêle.', 'Ajouter crème et moutarde, remettre la viande et mijoter 8 minutes.', 'Cuire les haricots verts à la vapeur ou à l’eau 10 minutes et servir ensemble.'],
    tags: ['gourmand', 'convivial'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'saucisses-lentilles', name: 'Saucisses aux lentilles', emoji: '🌭', description: 'Un plat d’hiver complet et économique.',
    servings: 4, prepMinutes: 10, cookMinutes: 35, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'française',
    ingredients: [i('saucisse', 4, 'piece'), i('lentilles_vertes', 300), i('carotte', 2, 'piece'), i('oignon', 1, 'piece'), i('bouillon_legumes', 1, 'piece'), i('laurier', 1, 'piece'), i('moutarde', 1, 'cac'), taste('poivre')],
    steps: ['Faire dorer les saucisses dans une cocotte, les réserver.', 'Faire revenir l’oignon et les carottes en dés.', 'Ajouter les lentilles, le laurier et le cube avec 90 cl d’eau ; cuire 25 minutes.', 'Remettre les saucisses 10 minutes, ajouter la moutarde avant de servir.'],
    tags: ['reconfortant', 'economique', 'batch'], storage: { fridgeDays: 3, freezable: true },
  }),
  r({
    id: 'quiche-lorraine', name: 'Quiche lorraine', emoji: '🥧', description: 'Le grand classique, à servir avec une salade verte.',
    servings: 6, prepMinutes: 15, cookMinutes: 35, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'française', equipment: ['four'],
    ingredients: [i('pate_brisee', 1, 'piece'), i('lardons', 200), i('oeuf', 3, 'piece'), i('creme_fraiche', 200, 'ml'), i('lait', 100, 'ml'), i('emmental_rape', 60), i('salade_verte', 1, 'piece', { note: 'en accompagnement' }), taste('muscade'), taste('poivre')],
    steps: ['Préchauffer le four à 190 °C et foncer un moule avec la pâte.', 'Faire dorer les lardons à sec, les répartir sur la pâte.', 'Battre œufs, crème, lait, muscade et poivre ; verser, parsemer d’emmental.', 'Cuire 35 minutes ; servir avec la salade.'],
    tags: ['convivial', 'gourmand'], storage: { fridgeDays: 3, freezable: true },
  }),
  r({
    id: 'croque-monsieur', name: 'Croque-monsieur et salade', emoji: '🥪', description: 'Doré, fondant, prêt en 15 minutes.',
    servings: 2, prepMinutes: 5, cookMinutes: 10, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'française', equipment: ['four'],
    ingredients: [i('pain_complet', 4, 'tranche'), i('jambon_blanc', 2, 'tranche'), i('emmental_rape', 60), i('beurre', 15), i('salade_verte', 0.5, 'piece'), i('vinaigre_vin', 1, 'cas'), i('huile_olive', 2, 'cas')],
    steps: ['Préchauffer le four à 220 °C (ou utiliser une poêle).', 'Beurrer le pain, garnir de jambon et de la moitié du fromage, refermer.', 'Parsemer le reste de fromage et cuire 10 minutes.', 'Servir avec la salade assaisonnée.'],
    tags: ['rapide', 'gourmand', 'enfants'], storage: { fridgeDays: 0, freezable: false },
  }),

  // --- Poissons ----------------------------------------------------------------------------
  r({
    id: 'saumon-brocoli-riz', name: 'Saumon au four, brocoli et riz', emoji: '🍣', description: 'Équilibré et simple : tout cuit en 20 minutes.',
    servings: 2, prepMinutes: 5, cookMinutes: 18, difficulty: 1, slots: MAIN, course: 'plat', equipment: ['plaque', 'four'],
    ingredients: [i('saumon', 2, 'piece'), i('brocoli', 0.5, 'piece'), i('riz', 150), i('citron', 0.5, 'piece'), i('huile_olive', 1, 'cas'), taste('sel'), taste('poivre')],
    steps: ['Préchauffer le four à 200 °C et lancer la cuisson du riz.', 'Poser les pavés sur une plaque avec l’huile, sel, poivre et rondelles de citron.', 'Cuire 12 à 15 minutes.', 'Cuire le brocoli 6 minutes à la vapeur et servir le tout.'],
    tags: ['rapide', 'leger'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'cabillaud-puree-patate-douce', name: 'Cabillaud et purée de patate douce', emoji: '🐠', description: 'Doux et coloré, pour les soirs où l’on veut léger.',
    servings: 2, prepMinutes: 10, cookMinutes: 20, difficulty: 1, slots: MAIN, course: 'plat',
    ingredients: [i('cabillaud', 2, 'piece'), i('patate_douce', 500), i('beurre', 15), i('citron', 0.5, 'piece'), opt('persil', 5), taste('sel'), taste('poivre')],
    steps: ['Cuire la patate douce en cubes 15 minutes à l’eau salée.', 'L’écraser avec le beurre, saler et poivrer.', 'Cuire le cabillaud 4 minutes par face à la poêle.', 'Servir avec un filet de citron et le persil.'],
    tags: ['leger'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'papillote-poisson-courgettes', name: 'Papillotes de poisson aux courgettes', emoji: '🐟', description: 'Cuisson douce et sans matière grasse ajoutée, ou presque.',
    servings: 4, prepMinutes: 15, cookMinutes: 20, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'méditerranéenne', equipment: ['four'],
    ingredients: [i('colin_surgele', 400), i('courgette', 2, 'piece'), i('tomate_cerise', 250), i('citron', 1, 'piece'), i('huile_olive', 2, 'cas'), i('herbes_provence', 1, 'cac'), i('riz', 250), taste('sel'), taste('poivre')],
    steps: ['Préchauffer le four à 200 °C ; décongeler le poisson si besoin.', 'Répartir courgettes en fines rondelles, tomates et poisson sur 4 feuilles de papier cuisson.', 'Arroser d’huile et de citron, assaisonner, refermer.', 'Cuire 20 minutes ; servir avec le riz.'],
    tags: ['leger', 'economique'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'riz-saute-crevettes', name: 'Riz sauté aux crevettes', emoji: '🍤', description: 'Façon cantonaise, idéal avec un reste de riz.',
    servings: 4, prepMinutes: 10, cookMinutes: 10, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'asiatique',
    ingredients: [i('riz', 300), i('crevettes', 300), i('petits_pois', 200), i('oeuf', 3, 'piece'), i('oignon', 1, 'piece'), i('sauce_soja', 3, 'cas'), i('huile_tournesol', 2, 'cas')],
    steps: ['Cuire le riz (ou utiliser un reste bien froid).', 'Faire une omelette fine, la couper en lanières.', 'Sauter l’oignon, les petits pois puis le riz à feu vif dans l’huile.', 'Ajouter crevettes, omelette et sauce soja, mélanger 2 minutes.'],
    tags: ['rapide', 'anti_gaspi'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'salade-nicoise', name: 'Salade niçoise', emoji: '🫒', description: 'Généreuse et estivale, un repas complet.',
    servings: 4, prepMinutes: 20, cookMinutes: 15, difficulty: 1, slots: MAIN, course: 'salade', cuisine: 'méditerranéenne',
    ingredients: [i('thon_boite', 280), i('oeuf', 4, 'piece'), i('tomate', 4, 'piece'), i('haricots_verts', 250), i('pomme_de_terre', 400), i('olives_noires', 60), i('salade_verte', 1, 'piece'), i('huile_olive', 4, 'cas'), i('vinaigre_vin', 2, 'cas'), taste('sel')],
    steps: ['Cuire les pommes de terre 15 minutes, les haricots 8 minutes et les œufs 9 minutes.', 'Couper tomates, pommes de terre et œufs.', 'Disposer sur la salade avec le thon, les haricots et les olives.', 'Arroser d’une vinaigrette huile-vinaigre.'],
    tags: ['convivial'], storage: { fridgeDays: 1, freezable: false },
  }),
  r({
    id: 'salade-riz-thon', name: 'Salade de riz au thon', emoji: '🍚', description: 'À préparer la veille pour le déjeuner.',
    servings: 4, prepMinutes: 15, cookMinutes: 12, difficulty: 1, slots: MAIN, course: 'salade',
    ingredients: [i('riz', 250), i('thon_boite', 140), i('mais', 285), i('tomate', 3, 'piece'), i('oeuf', 2, 'piece'), i('huile_olive', 3, 'cas'), i('vinaigre_vin', 1, 'cas'), opt('ciboulette', 5), taste('sel')],
    steps: ['Cuire le riz et les œufs (9 minutes), laisser refroidir.', 'Couper tomates et œufs en dés.', 'Mélanger riz, thon, maïs égoutté, tomates et œufs.', 'Assaisonner d’huile, vinaigre et sel.'],
    tags: ['economique', 'batch'], storage: { fridgeDays: 2, freezable: false },
  }),

  // --- Vegetarien et vegetalien -------------------------------------------------------------
  r({
    id: 'dahl-lentilles-corail', name: 'Dahl de lentilles corail', emoji: '🟠', description: 'Végétalien, économique, réconfortant.',
    servings: 4, prepMinutes: 10, cookMinutes: 25, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'indienne',
    ingredients: [i('lentilles_corail', 250), i('lait_coco', 400, 'ml'), i('tomates_concassees', 400), i('oignon', 1, 'piece'), i('ail', 2, 'gousse'), i('gingembre', 10), i('curry', 1, 'cas'), i('curcuma', 1, 'cac'), i('huile_tournesol', 1, 'cas'), i('riz', 250), opt('coriandre', 10), taste('sel')],
    steps: ['Faire revenir oignon, ail, gingembre et épices dans l’huile.', 'Ajouter les lentilles rincées, les tomates, le lait de coco et 40 cl d’eau.', 'Cuire 20 minutes en remuant, jusqu’à texture fondante.', 'Servir avec le riz et la coriandre.'],
    tags: ['economique', 'batch', 'reconfortant'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'curry-pois-chiches-epinards', name: 'Curry de pois chiches aux épinards', emoji: '🥘', description: 'Un curry végétalien prêt en 20 minutes avec des produits du placard.',
    servings: 4, prepMinutes: 5, cookMinutes: 15, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'indienne',
    ingredients: [i('pois_chiches', 530), i('epinards_surgeles', 300), i('lait_coco', 400, 'ml'), i('tomates_concassees', 400), i('oignon', 1, 'piece'), i('ail', 2, 'gousse'), i('curry', 2, 'cas'), i('huile_tournesol', 1, 'cas'), i('riz', 250), taste('sel')],
    steps: ['Faire revenir l’oignon et l’ail avec le curry.', 'Ajouter tomates, lait de coco et épinards ; cuire 8 minutes.', 'Ajouter les pois chiches rincés, réchauffer 5 minutes.', 'Servir avec le riz.'],
    tags: ['rapide', 'economique', 'batch'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'chili-sin-carne', name: 'Chili sin carne', emoji: '🫘', description: 'Toute la gourmandise du chili, version végétale.',
    servings: 6, prepMinutes: 15, cookMinutes: 35, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'mexicaine',
    ingredients: [i('haricots_rouges', 500), i('lentilles_vertes', 150), i('mais', 285), i('tomates_concassees', 800), i('oignon', 2, 'piece'), i('poivron', 2, 'piece'), i('ail', 2, 'gousse'), i('cumin', 2, 'cac'), i('paprika', 2, 'cac'), i('huile_olive', 2, 'cas'), i('riz', 400), taste('sel')],
    steps: ['Faire revenir oignons, ail et poivrons dans l’huile avec les épices.', 'Ajouter tomates, lentilles et 40 cl d’eau ; cuire 25 minutes.', 'Ajouter haricots rouges et maïs, cuire encore 10 minutes.', 'Servir avec le riz.'],
    tags: ['batch', 'economique', 'reconfortant'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'shakshuka', name: 'Shakshuka', emoji: '🍳', description: 'Œufs pochés dans une sauce tomate-poivron épicée.',
    servings: 2, prepMinutes: 10, cookMinutes: 20, difficulty: 1, slots: ['dejeuner', 'diner', 'petit_dejeuner'], course: 'plat', cuisine: 'orientale',
    ingredients: [i('oeuf', 4, 'piece'), i('tomates_concassees', 400), i('poivron', 1, 'piece'), i('oignon', 1, 'piece'), i('ail', 1, 'gousse'), i('cumin', 1, 'cac'), i('paprika', 1, 'cac'), i('huile_olive', 2, 'cas'), i('pain', 0.5, 'piece'), opt('coriandre', 5), taste('sel')],
    steps: ['Faire revenir oignon, poivron et ail dans l’huile 8 minutes.', 'Ajouter les épices et les tomates, laisser réduire 8 minutes.', 'Creuser 4 puits, y casser les œufs, couvrir et cuire 5 minutes.', 'Servir dans la poêle avec le pain.'],
    tags: ['economique', 'convivial'], storage: { fridgeDays: 0, freezable: false },
  }),
  r({
    id: 'omelette-champignons', name: 'Omelette aux champignons et salade', emoji: '🍄', description: 'Le dîner express par excellence.',
    servings: 2, prepMinutes: 5, cookMinutes: 10, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'française',
    ingredients: [i('oeuf', 5, 'piece'), i('champignon', 200), i('beurre', 15), i('salade_verte', 0.5, 'piece'), i('huile_olive', 1, 'cas'), opt('persil', 5), taste('sel'), taste('poivre')],
    steps: ['Faire sauter les champignons émincés dans la moitié du beurre.', 'Battre les œufs, saler, poivrer.', 'Cuire l’omelette avec le reste du beurre, ajouter les champignons et plier.', 'Servir avec la salade.'],
    tags: ['rapide', 'economique'], storage: { fridgeDays: 0, freezable: false },
  }),
  r({
    id: 'ratatouille', name: 'Ratatouille', emoji: '🍆', description: 'Le meilleur de l’été, à faire en grande quantité.',
    servings: 6, prepMinutes: 25, cookMinutes: 45, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'méditerranéenne',
    ingredients: [i('courgette', 3, 'piece'), i('aubergine', 2, 'piece'), i('poivron', 2, 'piece'), i('tomate', 5, 'piece'), i('oignon', 2, 'piece'), i('ail', 3, 'gousse'), i('huile_olive', 4, 'cas'), i('herbes_provence', 2, 'cac'), i('semoule', 300, 'g', { note: 'ou riz, en accompagnement' }), taste('sel'), taste('poivre')],
    steps: ['Couper tous les légumes en dés.', 'Faire revenir oignons et poivrons dans l’huile 5 minutes, puis aubergines et courgettes 10 minutes.', 'Ajouter tomates, ail et herbes ; mijoter 30 minutes à couvert.', 'Servir avec la semoule.'],
    tags: ['batch', 'leger', 'economique'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'soupe-potiron', name: 'Velouté de courge', emoji: '🎃', description: 'Doux et velouté, le classique de l’automne.',
    servings: 4, prepMinutes: 15, cookMinutes: 25, difficulty: 1, slots: MAIN, course: 'soupe', cuisine: 'française', equipment: ['plaque', 'mixeur'],
    ingredients: [i('potiron', 1000), i('pomme_de_terre', 1, 'piece'), i('oignon', 1, 'piece'), i('bouillon_legumes', 1, 'piece'), i('creme_liquide', 100, 'ml'), i('pain', 0.5, 'piece', { note: 'en accompagnement' }), taste('muscade'), taste('sel'), taste('poivre')],
    steps: ['Éplucher et couper la courge, la pomme de terre et l’oignon.', 'Couvrir de 1 litre d’eau avec le cube, cuire 25 minutes.', 'Mixer avec la crème, assaisonner de muscade, sel et poivre.', 'Servir avec le pain.'],
    tags: ['reconfortant', 'batch', 'leger'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'veloute-poireaux', name: 'Velouté poireaux-pommes de terre', emoji: '🥬', description: 'Simple et économique, se congèle très bien.',
    servings: 4, prepMinutes: 15, cookMinutes: 25, difficulty: 1, slots: MAIN, course: 'soupe', cuisine: 'française', equipment: ['plaque', 'mixeur'],
    ingredients: [i('poireau', 3, 'piece'), i('pomme_de_terre', 3, 'piece'), i('bouillon_legumes', 1, 'piece'), i('beurre', 15), opt('creme_fraiche', 50, 'ml'), i('pain', 0.5, 'piece', { note: 'en accompagnement' }), taste('sel'), taste('poivre')],
    steps: ['Laver et émincer les poireaux, éplucher les pommes de terre.', 'Faire fondre les poireaux dans le beurre 5 minutes.', 'Ajouter les pommes de terre et 1 litre d’eau avec le cube, cuire 20 minutes.', 'Mixer, ajouter la crème si souhaité.'],
    tags: ['economique', 'batch', 'reconfortant'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'soupe-lentilles-carottes', name: 'Soupe de lentilles corail et carottes', emoji: '🥕', description: 'Végétalienne, rassasiante et pleine de fibres.',
    servings: 4, prepMinutes: 10, cookMinutes: 20, difficulty: 1, slots: MAIN, course: 'soupe', equipment: ['plaque', 'mixeur'],
    ingredients: [i('lentilles_corail', 150), i('carotte', 4, 'piece'), i('oignon', 1, 'piece'), i('lait_coco', 200, 'ml'), i('bouillon_legumes', 1, 'piece'), i('cumin', 1, 'cac'), i('huile_olive', 1, 'cas'), taste('sel')],
    steps: ['Faire revenir l’oignon et le cumin dans l’huile.', 'Ajouter carottes en rondelles, lentilles et 1 litre d’eau avec le cube.', 'Cuire 20 minutes.', 'Mixer avec le lait de coco.'],
    tags: ['economique', 'batch', 'leger'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'gratin-chou-fleur', name: 'Gratin de chou-fleur', emoji: '🥦', description: 'Béchamel légère et dessus doré.',
    servings: 4, prepMinutes: 15, cookMinutes: 35, difficulty: 2, slots: MAIN, course: 'plat', cuisine: 'française', equipment: ['plaque', 'four'],
    ingredients: [i('chou_fleur', 1, 'piece'), i('lait', 500, 'ml'), i('beurre', 40), i('farine', 40), i('emmental_rape', 100), taste('muscade'), taste('sel'), taste('poivre')],
    steps: ['Cuire les bouquets de chou-fleur 8 minutes à l’eau salée, égoutter.', 'Béchamel : fondre le beurre, ajouter la farine puis le lait en fouettant jusqu’à épaississement.', 'Assaisonner de muscade, ajouter la moitié du fromage.', 'Napper le chou-fleur, couvrir du reste de fromage et gratiner 25 minutes à 200 °C.'],
    tags: ['reconfortant', 'gourmand'], storage: { fridgeDays: 3, freezable: false },
  }),
  r({
    id: 'buddha-bowl-quinoa', name: 'Buddha bowl quinoa, patate douce et pois chiches', emoji: '🥙', description: 'Coloré, complet et végétalien.',
    servings: 2, prepMinutes: 15, cookMinutes: 25, difficulty: 1, slots: MAIN, course: 'salade', equipment: ['plaque', 'four'],
    ingredients: [i('quinoa', 120), i('patate_douce', 1, 'piece'), i('pois_chiches', 265), i('avocat', 1, 'piece'), i('epinards', 60), i('citron', 1, 'piece'), i('huile_olive', 3, 'cas'), i('paprika', 1, 'cac'), taste('sel')],
    steps: ['Rôtir la patate douce en cubes et les pois chiches avec le paprika et 1 c. à soupe d’huile, 25 minutes à 200 °C.', 'Cuire le quinoa 12 minutes.', 'Préparer une sauce avec le jus de citron, le reste d’huile et le sel.', 'Assembler dans des bols avec les épinards et l’avocat.'],
    tags: ['leger'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'salade-lentilles-feta', name: 'Salade de lentilles à la feta', emoji: '🥗', description: 'Se prépare à l’avance, idéale au déjeuner.',
    servings: 4, prepMinutes: 15, cookMinutes: 25, difficulty: 1, slots: MAIN, course: 'salade', cuisine: 'méditerranéenne',
    ingredients: [i('lentilles_vertes', 250), i('feta', 150), i('concombre', 1, 'piece'), i('oignon_rouge', 1, 'piece'), i('persil', 15), i('huile_olive', 4, 'cas'), i('vinaigre_vin', 2, 'cas'), i('moutarde', 1, 'cac'), taste('sel')],
    steps: ['Cuire les lentilles 25 minutes dans l’eau non salée, égoutter et laisser tiédir.', 'Couper concombre, oignon et feta en dés, ciseler le persil.', 'Préparer une vinaigrette moutarde-vinaigre-huile.', 'Tout mélanger.'],
    tags: ['batch', 'economique'], storage: { fridgeDays: 3, freezable: false },
  }),
  r({
    id: 'tofu-saute-legumes', name: 'Tofu sauté aux légumes et sauce soja', emoji: '🥡', description: 'Un sauté végétalien croustillant et rapide.',
    servings: 4, prepMinutes: 15, cookMinutes: 15, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'asiatique',
    ingredients: [i('tofu_ferme', 400), i('brocoli', 1, 'piece'), i('poivron', 1, 'piece'), i('gingembre', 10), i('ail', 2, 'gousse'), i('sauce_soja', 4, 'cas'), i('maizena', 1, 'cas'), i('huile_tournesol', 3, 'cas'), i('riz', 300)],
    steps: ['Cuire le riz.', 'Couper le tofu en cubes, l’enrober de maïzena et le dorer 8 minutes dans l’huile.', 'Sauter brocoli et poivron avec ail et gingembre 5 minutes.', 'Remettre le tofu, ajouter la sauce soja et servir avec le riz.'],
    tags: ['rapide'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'pizza-maison-legumes', name: 'Pizza maison aux légumes', emoji: '🍕', description: 'La soirée pizza, garnie à votre façon.',
    servings: 4, prepMinutes: 15, cookMinutes: 15, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'italienne', equipment: ['four'],
    ingredients: [i('pate_pizza', 400), i('passata', 200), i('mozzarella', 2, 'piece'), i('poivron', 1, 'piece'), i('champignon', 150), i('olives_noires', 40), i('herbes_provence', 1, 'cac'), i('huile_olive', 1, 'cas'), opt('basilic', 5)],
    steps: ['Préchauffer le four à 240 °C.', 'Étaler la pâte, la napper de coulis et d’herbes.', 'Garnir de poivron, champignons, mozzarella et olives, arroser d’huile.', 'Cuire 12 à 15 minutes ; ajouter le basilic à la sortie.'],
    tags: ['convivial', 'gourmand', 'enfants'], storage: { fridgeDays: 2, freezable: true },
  }),
  r({
    id: 'tarte-poireaux-chevre', name: 'Tarte poireaux-chèvre', emoji: '🥧', description: 'Fondante et parfumée, servie chaude ou tiède.',
    servings: 6, prepMinutes: 20, cookMinutes: 35, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'française', equipment: ['plaque', 'four'],
    ingredients: [i('pate_brisee', 1, 'piece'), i('poireau', 3, 'piece'), i('chevre', 150), i('oeuf', 3, 'piece'), i('creme_fraiche', 200, 'ml'), i('beurre', 15), i('salade_verte', 1, 'piece', { note: 'en accompagnement' }), taste('sel'), taste('poivre')],
    steps: ['Préchauffer le four à 190 °C et foncer le moule.', 'Faire fondre les poireaux émincés dans le beurre 10 minutes.', 'Battre œufs et crème, saler, poivrer ; ajouter les poireaux.', 'Verser sur la pâte, disposer les rondelles de chèvre et cuire 35 minutes.'],
    tags: ['convivial', 'gourmand'], storage: { fridgeDays: 3, freezable: true },
  }),
  r({
    id: 'taboule', name: 'Taboulé frais', emoji: '🌱', description: 'Plein d’herbes, de citron et de crudités.',
    servings: 4, prepMinutes: 20, cookMinutes: 0, difficulty: 1, slots: MAIN, course: 'salade', cuisine: 'orientale', equipment: [],
    ingredients: [i('semoule', 200), i('tomate', 3, 'piece'), i('concombre', 1, 'piece'), i('persil', 30), i('menthe', 15), i('citron', 2, 'piece'), i('huile_olive', 4, 'cas'), i('oignon_rouge', 0.5, 'piece'), taste('sel')],
    steps: ['Verser 20 cl d’eau bouillante salée sur la semoule, couvrir 5 minutes puis égrainer.', 'Couper tomates, concombre et oignon en petits dés, ciseler les herbes.', 'Mélanger avec le jus de citron et l’huile.', 'Laisser reposer 1 heure au frais.'],
    tags: ['sans_cuisson', 'leger', 'batch', 'economique'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'couscous-legumes', name: 'Couscous de légumes aux pois chiches', emoji: '🍲', description: 'Un plat complet et généreux qui nourrit toute la tablée.',
    servings: 6, prepMinutes: 20, cookMinutes: 40, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'orientale',
    ingredients: [i('semoule', 400), i('pois_chiches', 530), i('carotte', 4, 'piece'), i('courgette', 2, 'piece'), i('oignon', 2, 'piece'), i('tomates_concassees', 400), i('bouillon_legumes', 2, 'piece'), i('cumin', 2, 'cac'), i('curcuma', 1, 'cac'), i('huile_olive', 3, 'cas'), taste('sel')],
    steps: ['Faire revenir les oignons avec les épices dans l’huile.', 'Ajouter carottes, tomates et 1,2 litre d’eau avec les cubes ; cuire 20 minutes.', 'Ajouter courgettes et pois chiches, cuire 15 minutes.', 'Préparer la semoule avec un peu de bouillon et servir avec les légumes.'],
    tags: ['batch', 'convivial', 'economique'], storage: { fridgeDays: 4, freezable: true },
  }),

  // --- Anti-gaspi --------------------------------------------------------------------------
  r({
    id: 'frittata-restes', name: 'Frittata fond de frigo', emoji: '🥚', description: 'Œufs, pommes de terre et légumes qui traînent : rien ne se perd.',
    servings: 4, prepMinutes: 10, cookMinutes: 20, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'italienne',
    ingredients: [i('oeuf', 6, 'piece'), i('pomme_de_terre', 2, 'piece'), i('courgette', 1, 'piece'), i('oignon', 1, 'piece'), i('emmental_rape', 50), i('huile_olive', 2, 'cas'), taste('sel'), taste('poivre')],
    steps: ['Couper pommes de terre en fines rondelles et les cuire 10 minutes à la poêle avec l’oignon.', 'Ajouter la courgette (ou tout autre légume restant) 5 minutes.', 'Verser les œufs battus avec le fromage, sel et poivre.', 'Cuire 8 minutes à couvert à feu doux.'],
    tags: ['anti_gaspi', 'economique', 'rapide'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'riz-cantonais', name: 'Riz cantonais anti-gaspi', emoji: '🍳', description: 'Le meilleur moyen d’utiliser un reste de riz et de jambon.',
    servings: 4, prepMinutes: 10, cookMinutes: 10, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'asiatique',
    ingredients: [i('riz', 300), i('jambon_blanc', 3, 'tranche'), i('oeuf', 3, 'piece'), i('petits_pois', 200), i('oignon', 1, 'piece'), i('sauce_soja', 3, 'cas'), i('huile_tournesol', 2, 'cas')],
    steps: ['Utiliser un reste de riz froid (ou le cuire et le refroidir).', 'Faire une omelette fine et la couper en lanières.', 'Sauter oignon et petits pois, puis le riz à feu vif.', 'Ajouter jambon en dés, omelette et sauce soja.'],
    tags: ['anti_gaspi', 'rapide', 'economique', 'enfants'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'soupe-fond-frigo', name: 'Soupe de légumes fond de frigo', emoji: '🥣', description: 'Tous les légumes un peu fatigués deviennent une soupe maison.',
    servings: 4, prepMinutes: 15, cookMinutes: 25, difficulty: 1, slots: MAIN, course: 'soupe', equipment: ['plaque', 'mixeur'],
    ingredients: [i('carotte', 3, 'piece'), i('poireau', 1, 'piece'), i('pomme_de_terre', 2, 'piece'), i('courgette', 1, 'piece'), i('oignon', 1, 'piece'), i('bouillon_legumes', 1, 'piece'), i('huile_olive', 1, 'cas'), taste('sel'), taste('poivre')],
    steps: ['Couper tous les légumes en morceaux (n’importe quels légumes conviennent).', 'Les faire revenir 5 minutes dans l’huile.', 'Couvrir de 1,2 litre d’eau avec le cube, cuire 25 minutes.', 'Mixer et assaisonner.'],
    tags: ['anti_gaspi', 'economique', 'batch', 'leger'], storage: { fridgeDays: 4, freezable: true },
  }),
  r({
    id: 'gratin-courgettes', name: 'Gratin de courgettes', emoji: '🧀', description: 'Fondant et léger, pour les étés où les courgettes abondent.',
    servings: 4, prepMinutes: 15, cookMinutes: 30, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'française', equipment: ['plaque', 'four'],
    ingredients: [i('courgette', 4, 'piece'), i('oeuf', 2, 'piece'), i('creme_fraiche', 150, 'ml'), i('emmental_rape', 80), i('ail', 1, 'gousse'), i('huile_olive', 1, 'cas'), i('riz', 200, 'g', { note: 'en accompagnement' }), taste('sel'), taste('poivre')],
    steps: ['Préchauffer le four à 200 °C.', 'Faire revenir les courgettes en rondelles avec l’ail 8 minutes.', 'Battre œufs et crème, saler, poivrer.', 'Mettre les courgettes dans un plat, napper, couvrir de fromage et gratiner 25 minutes.'],
    tags: ['anti_gaspi', 'leger'], storage: { fridgeDays: 3, freezable: false },
  }),
  r({
    id: 'tartines-sardines', name: 'Tartines de rillettes de sardines', emoji: '🐟', description: 'Un déjeuner rapide riche en oméga-3.',
    servings: 2, prepMinutes: 10, cookMinutes: 0, difficulty: 1, slots: ['dejeuner'], course: 'plat', equipment: [],
    ingredients: [i('sardines_boite', 230), i('fromage_blanc', 80), i('citron', 0.5, 'piece'), i('pain_complet', 4, 'tranche'), i('salade_verte', 0.5, 'piece'), i('ciboulette', 5), taste('poivre')],
    steps: ['Écraser les sardines égouttées avec le fromage blanc et le jus de citron.', 'Ajouter la ciboulette ciselée et poivrer.', 'Tartiner sur le pain grillé.', 'Servir avec la salade.'],
    tags: ['rapide', 'sans_cuisson', 'economique'], storage: { fridgeDays: 2, freezable: false },
  }),
  r({
    id: 'poelee-legumes-oeufs', name: 'Poêlée de légumes et œufs au plat', emoji: '🍳', description: 'Le dîner de dernière minute avec un sachet de légumes surgelés.',
    servings: 2, prepMinutes: 2, cookMinutes: 12, difficulty: 1, slots: MAIN, course: 'plat',
    ingredients: [i('poelee_legumes', 500), i('oeuf', 4, 'piece'), i('huile_olive', 1, 'cas'), i('pain', 0.5, 'piece'), taste('sel'), taste('poivre')],
    steps: ['Faire sauter la poêlée encore surgelée dans l’huile 8 minutes.', 'Creuser des puits, y casser les œufs.', 'Couvrir et cuire 4 minutes.', 'Servir avec le pain.'],
    tags: ['rapide', 'economique', 'leger'], storage: { fridgeDays: 0, freezable: false },
  }),
  r({
    id: 'patates-douces-farcies', name: 'Patates douces rôties, haricots et feta', emoji: '🍠', description: 'Fondantes au four, garnies façon mexicaine.',
    servings: 4, prepMinutes: 10, cookMinutes: 40, difficulty: 1, slots: MAIN, course: 'plat', cuisine: 'mexicaine', equipment: ['four'],
    ingredients: [i('patate_douce', 4, 'piece'), i('haricots_rouges', 250), i('feta', 100), i('mais', 140), i('citron_vert', 1, 'piece'), i('cumin', 1, 'cac'), i('huile_olive', 2, 'cas'), opt('coriandre', 10), taste('sel')],
    steps: ['Rôtir les patates douces entières 40 minutes à 200 °C.', 'Réchauffer haricots et maïs avec le cumin et l’huile.', 'Ouvrir les patates, garnir des haricots, de feta émiettée et de citron vert.', 'Parsemer de coriandre.'],
    tags: ['economique', 'convivial'], storage: { fridgeDays: 2, freezable: false },
  }),
]
