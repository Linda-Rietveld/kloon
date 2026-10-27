create extension if not exists vector;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  mime_type text not null,
  storage_bucket text not null default 'documents',
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(768) not null,
  chunk_index integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clone_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  system_prompt text not null default 'Je bent een behulpzame AI-kloon. Gebruik uitsluitend de meegeleverde bronnen. Als het antwoord niet in de bronnen staat, zeg dat eerlijk.',
  updated_at timestamptz not null default now()
);

create index if not exists chunks_embedding_hnsw_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);

create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists chunks_document_id_idx on public.chunks(document_id);

alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.clone_settings enable row level security;

create policy "Users can read their documents"
  on public.documents for select to authenticated
  using (user_id = auth.uid());
create policy "Users can create their documents"
  on public.documents for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users can update their documents"
  on public.documents for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Users can delete their documents"
  on public.documents for delete to authenticated
  using (user_id = auth.uid());

create policy "Users can read their chunks"
  on public.chunks for select to authenticated
  using (user_id = auth.uid());
create policy "Users can create their chunks"
  on public.chunks for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users can delete their chunks"
  on public.chunks for delete to authenticated
  using (user_id = auth.uid());

create policy "Users can read their settings"
  on public.clone_settings for select to authenticated
  using (user_id = auth.uid());
create policy "Users can create their settings"
  on public.clone_settings for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users can update their settings"
  on public.clone_settings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.match_chunks(
  query_embedding vector(768),
  match_count integer default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  title text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.title
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = auth.uid()
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, delete on public.chunks to authenticated;
grant select, insert, update on public.clone_settings to authenticated;
grant execute on function public.match_chunks(vector(768), integer) to authenticated;

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;
end $$;

create policy "Users can upload their documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can read their uploaded documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can delete their uploaded documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
