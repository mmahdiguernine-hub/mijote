-- Nutrition sportive et batch cooking.
-- Les seances (manuelles ou synchronisees depuis PeakMind), les courses objectif et les sessions de
-- batch sont de petits documents JSON, stockes dans une table generique proprietaire (RLS).

alter table public.plan_entries add column if not exists cook_on date;
alter table public.plan_entries add column if not exists batch_id text;

create table public.user_documents (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('seance', 'course', 'batch')),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index user_documents_user_kind on public.user_documents (user_id, kind);

alter table public.user_documents enable row level security;
create policy "documents personnels" on public.user_documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
