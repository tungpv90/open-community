-- The community now runs on its own Supabase project instead of sharing APAX ID's.
-- Define the administrator roles it relied on from that project, and stop labelling
-- accounts by their source.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin','user')),
  updated_at timestamptz not null default now()
);

-- Security definer so RLS policies can call it without recursing into user_roles policies.
create or replace function public.is_admin(target_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.user_roles r where r.user_id = target_user_id and r.role = 'admin'
  );
$$;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated;

alter table public.user_roles enable row level security;
drop policy if exists user_roles_read on public.user_roles;
create policy user_roles_read on public.user_roles for select
using(auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists user_roles_admin on public.user_roles;
create policy user_roles_admin on public.user_roles for all
using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));

drop function if exists public.forum_admin_users();
create function public.forum_admin_users() returns table(id uuid,email text,email_confirmed_at timestamptz,username text,display_name text,status text,role text,joined_at timestamptz,last_seen_at timestamptz)
language sql security definer set search_path='' as $$
  select
    u.id,
    u.email,
    u.email_confirmed_at,
    coalesce(p.username,split_part(u.email,'@',1),left(u.id::text,8)),
    coalesce(p.display_name,u.raw_user_meta_data->>'display_name',split_part(u.email,'@',1),'Member'),
    coalesce(p.status,'active'),
    case when r.role='admin' then 'admin' else coalesce(p.forum_role,'member') end,
    coalesce(p.joined_at,u.created_at),
    coalesce(p.last_seen_at,u.last_sign_in_at)
  from auth.users u
  left join public.forum_profiles p on p.id=u.id
  left join public.user_roles r on r.user_id=u.id
  where public.is_admin(auth.uid())
  order by u.created_at desc;
$$;
revoke all on function public.forum_admin_users() from public,anon;
grant execute on function public.forum_admin_users() to authenticated;

notify pgrst,'reload schema';
