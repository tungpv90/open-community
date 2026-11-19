-- Forum migration for the SAME Supabase project used by paddle-nextjs-starter-kit.
-- Accounts remain in auth.users; administrators remain in public.user_roles.
-- Run once in that project's Supabase SQL Editor or migration pipeline.

create extension if not exists pgcrypto;

create table if not exists public.forum_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text not null default '',
  avatar_url text,
  avatar_color text not null default '#e7672e',
  forum_role text not null default 'member' check (forum_role in ('member','moderator')),
  status text not null default 'active' check (status in ('active','suspended','banned')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.forum_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  color text not null default '#e7672e',
  icon text,
  parent_id uuid references public.forum_tags(id) on delete set null,
  position integer not null default 0,
  is_restricted boolean not null default false,
  is_hidden_all boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_discussions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 6 and 140),
  slug text not null unique,
  content text not null check (char_length(content) >= 10),
  reply_count integer not null default 0,
  view_count integer not null default 0,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  is_hidden boolean not null default false,
  is_solved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_discussion_tags (
  discussion_id uuid references public.forum_discussions(id) on delete cascade,
  tag_id uuid references public.forum_tags(id) on delete cascade,
  primary key (discussion_id, tag_id)
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.forum_discussions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  number integer not null,
  content text not null check (char_length(content) >= 1),
  like_count integer not null default 0,
  is_hidden boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discussion_id, number)
);

create table if not exists public.forum_likes (
  post_id uuid references public.forum_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.forum_follows (
  discussion_id uuid references public.forum_discussions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  mode text not null default 'follow' check (mode in ('follow','ignore')),
  created_at timestamptz not null default now(),
  primary key (discussion_id, user_id)
);

create table if not exists public.forum_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  message text not null,
  discussion_id uuid references public.forum_discussions(id) on delete cascade,
  post_id uuid references public.forum_posts(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.forum_posts(id) on delete cascade,
  discussion_id uuid references public.forum_discussions(id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open','dismissed','resolved')),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#667d99',
  icon text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_group_members (
  group_id uuid references public.forum_groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.forum_permissions (
  id uuid primary key default gen_random_uuid(),
  permission text not null,
  group_id uuid not null references public.forum_groups(id) on delete cascade,
  tag_id uuid references public.forum_tags(id) on delete cascade,
  allowed boolean not null default true
);
create unique index if not exists forum_permissions_scope_unique on public.forum_permissions(permission,group_id,coalesce(tag_id,'00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.forum_moderation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.forum_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base_username text;
begin
  base_username := regexp_replace(lower(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1), 'member')), '[^a-z0-9_]+', '_', 'g');
  insert into public.forum_profiles(id,username,display_name)
  values(new.id, left(base_username,40) || '_' || left(new.id::text,5), coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists forum_on_auth_user_created on auth.users;
create trigger forum_on_auth_user_created after insert on auth.users for each row execute procedure public.forum_handle_new_user();

insert into public.forum_profiles(id,username,display_name)
select u.id, left(regexp_replace(lower(coalesce(u.raw_user_meta_data->>'display_name',split_part(u.email,'@',1),'member')),'[^a-z0-9_]+','_','g'),40)||'_'||left(u.id::text,5), coalesce(u.raw_user_meta_data->>'display_name',split_part(u.email,'@',1))
from auth.users u on conflict(id) do nothing;

create or replace function public.forum_update_discussion_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op='INSERT' then update public.forum_discussions set reply_count=reply_count+1,updated_at=now() where id=new.discussion_id;
  elsif tg_op='DELETE' then update public.forum_discussions set reply_count=greatest(reply_count-1,0),updated_at=now() where id=old.discussion_id;
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists forum_posts_update_discussion on public.forum_posts;
create trigger forum_posts_update_discussion after insert or delete on public.forum_posts for each row execute procedure public.forum_update_discussion_stats();

create or replace function public.forum_admin_users() returns table(id uuid,username text,display_name text,status text,role text,joined_at timestamptz,last_seen_at timestamptz)
language sql security definer set search_path=public as $$
  select p.id,p.username,p.display_name,p.status,case when r.role='admin' then 'admin' else p.forum_role end,p.joined_at,p.last_seen_at
  from public.forum_profiles p left join public.user_roles r on r.user_id=p.id
  where public.is_admin(auth.uid()) order by p.joined_at desc;
$$;
revoke all on function public.forum_admin_users() from public,anon;
grant execute on function public.forum_admin_users() to authenticated;

alter table public.forum_profiles enable row level security;
alter table public.forum_tags enable row level security;
alter table public.forum_discussions enable row level security;
alter table public.forum_discussion_tags enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_likes enable row level security;
alter table public.forum_follows enable row level security;
alter table public.forum_notifications enable row level security;
alter table public.forum_reports enable row level security;
alter table public.forum_settings enable row level security;
alter table public.forum_groups enable row level security;
alter table public.forum_group_members enable row level security;
alter table public.forum_permissions enable row level security;
alter table public.forum_moderation_logs enable row level security;

drop policy if exists forum_profiles_read on public.forum_profiles;
create policy forum_profiles_read on public.forum_profiles for select using(true);
drop policy if exists forum_profiles_own_update on public.forum_profiles;
create policy forum_profiles_own_update on public.forum_profiles for update using(auth.uid()=id or public.is_admin(auth.uid()));
drop policy if exists forum_tags_read on public.forum_tags;
create policy forum_tags_read on public.forum_tags for select using(true);
drop policy if exists forum_tags_admin on public.forum_tags;
create policy forum_tags_admin on public.forum_tags for all using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
drop policy if exists forum_discussions_read on public.forum_discussions;
create policy forum_discussions_read on public.forum_discussions for select using(not is_hidden or public.is_admin(auth.uid()));
drop policy if exists forum_discussions_insert on public.forum_discussions;
create policy forum_discussions_insert on public.forum_discussions for insert with check(auth.uid()=user_id);
drop policy if exists forum_discussions_update on public.forum_discussions;
create policy forum_discussions_update on public.forum_discussions for update using(auth.uid()=user_id or public.is_admin(auth.uid()));
drop policy if exists forum_discussion_tags_read on public.forum_discussion_tags;
create policy forum_discussion_tags_read on public.forum_discussion_tags for select using(true);
drop policy if exists forum_discussion_tags_write on public.forum_discussion_tags;
create policy forum_discussion_tags_write on public.forum_discussion_tags for all to authenticated using(true) with check(true);
drop policy if exists forum_posts_read on public.forum_posts;
create policy forum_posts_read on public.forum_posts for select using(not is_hidden or public.is_admin(auth.uid()));
drop policy if exists forum_posts_insert on public.forum_posts;
create policy forum_posts_insert on public.forum_posts for insert with check(auth.uid()=user_id);
drop policy if exists forum_posts_update on public.forum_posts;
create policy forum_posts_update on public.forum_posts for update using(auth.uid()=user_id or public.is_admin(auth.uid()));
drop policy if exists forum_likes_read on public.forum_likes;
create policy forum_likes_read on public.forum_likes for select using(true);
drop policy if exists forum_likes_own on public.forum_likes;
create policy forum_likes_own on public.forum_likes for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists forum_follows_own on public.forum_follows;
create policy forum_follows_own on public.forum_follows for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists forum_notifications_own on public.forum_notifications;
create policy forum_notifications_own on public.forum_notifications for select using(auth.uid()=user_id);
drop policy if exists forum_notifications_update on public.forum_notifications;
create policy forum_notifications_update on public.forum_notifications for update using(auth.uid()=user_id);
drop policy if exists forum_reports_insert on public.forum_reports;
create policy forum_reports_insert on public.forum_reports for insert with check(auth.uid()=reporter_id);
drop policy if exists forum_reports_admin on public.forum_reports;
create policy forum_reports_admin on public.forum_reports for select using(public.is_admin(auth.uid()));
drop policy if exists forum_reports_admin_update on public.forum_reports;
create policy forum_reports_admin_update on public.forum_reports for update using(public.is_admin(auth.uid()));
drop policy if exists forum_settings_read on public.forum_settings;
create policy forum_settings_read on public.forum_settings for select using(true);
drop policy if exists forum_settings_admin on public.forum_settings;
create policy forum_settings_admin on public.forum_settings for all using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));

do $$ declare t text; begin
  foreach t in array array['forum_groups','forum_group_members','forum_permissions','forum_moderation_logs'] loop
    execute format('drop policy if exists %I on public.%I','admin_'||t,t);
    execute format('create policy %I on public.%I for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))','admin_'||t,t);
  end loop;
end $$;

insert into public.forum_tags(name,slug,color,position) values
('Hỗ trợ','ho-tro','#e7672e',1),('Tiện ích','tien-ich','#58a400',2),('Phát triển','phat-trien','#536dfe',3),('Meta','meta','#7b5fb5',4),('Tài nguyên','tai-nguyen','#3b9b9b',5),('Chuyện trò','chuyen-tro','#888',6)
on conflict(slug) do nothing;

insert into public.forum_groups(name,color,is_system) values
('Quản trị viên','#b72a2a',true),('Điều hành viên','#e7672e',true),('Thành viên','#667d99',true)
on conflict(name) do nothing;

insert into public.forum_settings(key,value) values('general','{"title":"Cộng Đồng Việt","description":"Nơi chia sẻ kiến thức, nhận trợ giúp và kết nối.","primary":"#e7672e","registration":"open"}'::jsonb)
on conflict(key) do nothing;

notify pgrst,'reload schema';
