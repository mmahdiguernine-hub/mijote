-- Mijote : schema initial.
--
-- Principes :
-- * Le catalogue (ingredients, recettes Mijote) est embarque dans l'application : il n'est pas en
--   base pour l'instant. Les recettes creees ou importees par l'utilisateur vont dans user_recipes.
-- * La liste de courses n'est PAS stockee : elle est recalculee a partir du planning et du stock.
--   On ne stocke que les ajouts manuels et les actions sur les lignes calculees (overrides).
-- * Chaque table porte user_id et une politique RLS "proprietaire uniquement". Le partage au sein
--   d'un foyer (V2) ajoutera household_id et des politiques basees sur l'appartenance au foyer,
--   sans changer les colonnes existantes.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.plan_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null,
  slot text not null check (slot in ('petit_dejeuner', 'dejeuner', 'diner', 'collation')),
  kind text not null check (kind in ('recette', 'reste', 'exterieur')),
  recipe_id text,
  variant text,
  servings integer not null check (servings > 0 and servings <= 50),
  leftover_servings integer check (leftover_servings is null or leftover_servings >= 0),
  leftover_of text,
  locked boolean not null default false,
  cooked_at timestamptz,
  note text check (note is null or length(note) <= 500),
  updated_at timestamptz not null default now()
);
create index plan_entries_user_date on public.plan_entries (user_id, date);

create table public.pantry_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  ingredient_id text not null,
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null,
  expires_on date,
  expiry_estimated boolean not null default false,
  added_on date not null default current_date,
  source text not null default 'manuel' check (source in ('manuel', 'code_barres', 'photo', 'courses')),
  barcode text,
  updated_at timestamptz not null default now()
);
create index pantry_items_user on public.pantry_items (user_id);

create table public.shopping_lists (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (length(name) between 1 and 80),
  mode text not null check (mode in ('semaine', 'periode', 'recette', 'libre')),
  date_from date,
  date_to date,
  recipe_id text,
  servings integer,
  created_at timestamptz not null default now()
);

create table public.shopping_manual_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- null : article recurrent, ajoute a toutes les listes de la semaine
  list_id text,
  ingredient_id text,
  label text not null check (length(label) between 1 and 120),
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null default 'piece',
  aisle text not null default 'autre',
  recurring boolean not null default false,
  checked boolean not null default false,
  store text,
  updated_at timestamptz not null default now()
);
create index shopping_manual_items_user on public.shopping_manual_items (user_id);

create table public.shopping_overrides (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  list_id text not null,
  -- ingredient_id d'une ligne calculee, ou "manuel:<id>" pour un ajout manuel
  line_key text not null,
  checked boolean,
  removed boolean,
  quantity_override numeric,
  store text,
  updated_at timestamptz not null default now(),
  primary key (user_id, list_id, line_key)
);

create table public.user_recipes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  data jsonb not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS : chaque utilisateur ne voit et ne modifie que ses propres lignes.
alter table public.profiles enable row level security;
alter table public.plan_entries enable row level security;
alter table public.pantry_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_manual_items enable row level security;
alter table public.shopping_overrides enable row level security;
alter table public.user_recipes enable row level security;

create policy "profil personnel" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "planning personnel" on public.plan_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "stock personnel" on public.pantry_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "listes personnelles" on public.shopping_lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ajouts personnels" on public.shopping_manual_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "overrides personnels" on public.shopping_overrides
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recettes personnelles" on public.user_recipes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
