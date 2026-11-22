-- Discussion categories: every discussion belongs to exactly one admin-managed category.
-- Tags remain optional labels on top of the category.

create table if not exists public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 300),
  color text not null default '#e7672e',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.forum_discussions
  add column if not exists category_id uuid references public.forum_categories(id) on delete restrict;
create index if not exists forum_discussions_category_idx on public.forum_discussions(category_id);

alter table public.forum_categories enable row level security;
drop policy if exists forum_categories_read on public.forum_categories;
create policy forum_categories_read on public.forum_categories for select using(true);
drop policy if exists forum_categories_admin on public.forum_categories;
create policy forum_categories_admin on public.forum_categories for all
using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));

insert into public.forum_categories(name,slug,description,color,position) values
('General','general','Conversations that do not fit anywhere else.','#e7672e',1)
on conflict(slug) do nothing;

update public.forum_discussions
set category_id=(select id from public.forum_categories where slug='general')
where category_id is null;

notify pgrst,'reload schema';
