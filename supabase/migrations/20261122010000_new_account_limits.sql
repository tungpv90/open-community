-- Throttle accounts younger than 24 hours so a burst of throwaway signups cannot flood the forum.
-- Enforced in the database so it also applies to direct PostgREST calls with the public anon key.
-- New accounts may start 3 discussions and write 10 posts per rolling hour; admins are exempt.

create or replace function public.forum_enforce_new_account_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  account_created timestamptz;
  recent integer;
begin
  if public.is_admin(new.user_id) then
    return new;
  end if;

  select u.created_at into account_created from auth.users u where u.id = new.user_id;
  if account_created is null or account_created < now() - interval '24 hours' then
    return new;
  end if;

  if tg_table_name = 'forum_discussions' then
    select count(*) into recent from public.forum_discussions d
    where d.user_id = new.user_id and d.created_at > now() - interval '1 hour';
    if recent >= 3 then
      raise exception 'New accounts can start up to 3 discussions per hour. Please try again later.'
        using errcode = 'P0001';
    end if;
  else
    select count(*) into recent from public.forum_posts p
    where p.user_id = new.user_id and p.created_at > now() - interval '1 hour';
    if recent >= 10 then
      raise exception 'New accounts can post up to 10 times per hour. Please try again later.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;
revoke all on function public.forum_enforce_new_account_limits() from public, anon, authenticated;

create index if not exists forum_discussions_user_created_idx
  on public.forum_discussions(user_id, created_at desc);
create index if not exists forum_posts_user_created_idx
  on public.forum_posts(user_id, created_at desc);

drop trigger if exists forum_discussions_new_account_limits on public.forum_discussions;
create trigger forum_discussions_new_account_limits before insert on public.forum_discussions
for each row execute procedure public.forum_enforce_new_account_limits();

drop trigger if exists forum_posts_new_account_limits on public.forum_posts;
create trigger forum_posts_new_account_limits before insert on public.forum_posts
for each row execute procedure public.forum_enforce_new_account_limits();
