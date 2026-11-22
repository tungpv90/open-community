-- Creates the default administrator account admin@apaxsoft.com with the initial password
-- admin@12345. The console forces a password change while that initial password is in use.
-- An existing account with this email keeps its password; it is only confirmed and promoted.
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  admin_email constant text := 'admin@apaxsoft.com';
  admin_id uuid;
begin
  select id into admin_id from auth.users where email = admin_email;

  if admin_id is null then
    admin_id := gen_random_uuid();
    insert into auth.users(
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      admin_email, extensions.crypt('admin@12345', extensions.gen_salt('bf', 10)), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Administrator"}'::jsonb, now(), now(),
      '', '', '', '', '', '', ''
    );
    insert into auth.identities(
      id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_id, 'email', admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', admin_email, 'email_verified', true),
      now(), now(), now()
    );
  else
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = admin_id;
  end if;

  insert into public.user_roles(user_id, role) values (admin_id, 'admin')
  on conflict(user_id) do update set role = 'admin', updated_at = now();
end $$;

-- True while the signed-in administrator still uses the initial password.
create or replace function public.forum_password_change_required() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select u.encrypted_password = extensions.crypt('admin@12345', u.encrypted_password)
    from auth.users u
    where u.id = auth.uid() and public.is_admin(u.id)
  ), false);
$$;
revoke all on function public.forum_password_change_required() from public, anon;
grant execute on function public.forum_password_change_required() to authenticated;
