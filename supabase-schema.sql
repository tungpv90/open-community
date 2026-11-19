-- Chạy một lần trong Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique, display_name text, bio text default '', avatar_url text,
  avatar_color text not null default '#6c5ce7', created_at timestamptz not null default now()
);
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  description text default '', color text not null default '#6c5ce7', position integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 6 and 140), slug text not null unique,
  content text not null check (char_length(content) >= 10), reply_count integer not null default 0,
  view_count integer not null default 0, is_pinned boolean not null default false,
  is_locked boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.discussion_tags (
  discussion_id uuid references public.discussions(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade, primary key (discussion_id, tag_id)
);
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(), discussion_id uuid not null references public.discussions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, number integer not null,
  content text not null check (char_length(content) >= 1), like_count integer not null default 0,
  is_hidden boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (discussion_id, number)
);
create table if not exists public.likes (
  post_id uuid references public.posts(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (post_id, user_id)
);
create table if not exists public.follows (
  discussion_id uuid references public.discussions(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (discussion_id, user_id)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null, type text not null, message text not null,
  discussion_id uuid references public.discussions(id) on delete cascade, is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1) || '_' || left(new.id::text, 5), coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.update_discussion_stats() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.discussions set reply_count = reply_count + 1, updated_at = now() where id = new.discussion_id;
  elsif tg_op = 'DELETE' then update public.discussions set reply_count = greatest(reply_count - 1, 0), updated_at = now() where id = old.discussion_id;
  end if; return coalesce(new, old);
end; $$;
drop trigger if exists posts_update_discussion on public.posts;
create trigger posts_update_discussion after insert or delete on public.posts for each row execute procedure public.update_discussion_stats();

alter table public.profiles enable row level security;
alter table public.tags enable row level security;
alter table public.discussions enable row level security;
alter table public.discussion_tags enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;

create policy "profiles_public_read" on public.profiles for select using (true);
create policy "profiles_own_update" on public.profiles for update using (auth.uid() = id);
create policy "tags_public_read" on public.tags for select using (true);
create policy "discussions_public_read" on public.discussions for select using (true);
create policy "discussions_own_insert" on public.discussions for insert with check (auth.uid() = user_id);
create policy "discussions_own_update" on public.discussions for update using (auth.uid() = user_id);
create policy "discussion_tags_public_read" on public.discussion_tags for select using (true);
create policy "discussion_tags_auth_insert" on public.discussion_tags for insert to authenticated with check (true);
create policy "posts_public_read" on public.posts for select using (not is_hidden);
create policy "posts_own_insert" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_own_update" on public.posts for update using (auth.uid() = user_id);
create policy "likes_public_read" on public.likes for select using (true);
create policy "likes_own_write" on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "follows_own_all" on public.follows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_own_read" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_own_update" on public.notifications for update using (auth.uid() = user_id);

insert into public.tags (name, slug, color, position) values
  ('Thông báo','thong-bao','#6c5ce7',1), ('Lập trình','lap-trinh','#20b486',2),
  ('Đời sống','doi-song','#f59e55',3), ('Chia sẻ','chia-se','#ef5b6a',4), ('Hỏi đáp','hoi-dap','#4a90e2',5)
on conflict (slug) do nothing;
