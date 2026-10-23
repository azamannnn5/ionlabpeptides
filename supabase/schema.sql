-- ION PEPTIDE ADMIN: DATABASE SETUP
-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again later (it only creates what is missing and updates functions).


-- 1. ADMIN USERS AND ROLES ---------------------------------------------------
-- Roles: owner (everything), admin (everything except users), editor (content, products, media, inbox), viewer (read only)
create table if not exists cms_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'editor' check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now()
);

create or replace function cms_role() returns text
language sql stable security definer set search_path = public as $$
  select role from cms_admins where user_id = auth.uid()
$$;

create or replace function cms_can(minrole text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case role when 'owner' then 4 when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end
      >= case minrole when 'owner' then 4 when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 9 end
    from cms_admins where user_id = auth.uid()
  ), false)
$$;

-- 2. CONTENT TABLES ---------------------------------------------------------
-- Only CHANGES are stored. Anything not in these tables uses the original text/prices baked into the site files.
create table if not exists cms_content (       -- page text, links, images (one row per edited field)
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists cms_settings (      -- site-wide settings (top bar, popup, shipping, SEO, scripts...)
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists cms_products (      -- product changes (one row per product id)
  id integer primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists cms_coupons (       -- promo codes (never sent to visitors; checked by validate_promo)
  code text primary key,
  kind text not null default 'percent' check (kind in ('percent','fixed','shipping')),
  amount numeric not null default 0,
  min_subtotal numeric not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  used integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists cms_messages (      -- contact form inbox
  id bigserial primary key,
  name text, email text, phone text, subject text, body text,
  status text not null default 'new' check (status in ('new','read','done','spam')),
  created_at timestamptz not null default now()
);
create table if not exists cms_media (         -- uploaded files (the files themselves live in Storage bucket "media")
  id bigserial primary key,
  path text unique not null,
  url text not null,
  name text,
  size integer,
  mime text,
  alt text,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create table if not exists cms_history (       -- every change, so you can see who changed what and undo it
  id bigserial primary key,
  at timestamptz not null default now(),
  by text,
  tbl text not null,
  key text not null,
  old jsonb,
  new jsonb
);
create index if not exists cms_history_at on cms_history (at desc);
create index if not exists cms_history_key on cms_history (tbl, key);

create table if not exists cms_snapshot (      -- the single small file visitors download (built automatically)
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into cms_snapshot (id, data) values (1, '{}'::jsonb) on conflict do nothing;

-- 3. AUTOMATIC SNAPSHOT + HISTORY -------------------------------------------
create or replace function cms_rebuild_snapshot() returns void
language plpgsql security definer set search_path = public as $$
begin
  update cms_snapshot set updated_at = now(), data = jsonb_build_object(
    'v', extract(epoch from now())::bigint,
    'content',  coalesce((select jsonb_object_agg(key, value) from cms_content), '{}'::jsonb),
    'settings', coalesce((select jsonb_object_agg(key, value) from cms_settings), '{}'::jsonb),
    'products', coalesce((select jsonb_object_agg(id::text, data) from cms_products), '{}'::jsonb)
  ) where id = 1;
end $$;

create or replace function cms_after_stmt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform cms_rebuild_snapshot();
  return null;
end $$;

create or replace function cms_log_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; k text; o jsonb; n jsonb;
begin
  select email into who from cms_admins where user_id = auth.uid();
  if tg_table_name = 'cms_products' then
    if tg_op <> 'INSERT' then k := old.id::text; o := old.data; end if;
    if tg_op <> 'DELETE' then k := new.id::text; n := new.data; end if;
  elsif tg_table_name = 'cms_coupons' then
    if tg_op <> 'INSERT' then k := old.code; o := to_jsonb(old); end if;
    if tg_op <> 'DELETE' then k := new.code; n := to_jsonb(new); end if;
  else
    if tg_op <> 'INSERT' then k := old.key; o := old.value; end if;
    if tg_op <> 'DELETE' then k := new.key; n := new.value; end if;
  end if;
  insert into cms_history (by, tbl, key, old, new) values (coalesce(who, 'system'), tg_table_name, k, o, n);
  return null;
end $$;

drop trigger if exists cms_content_snap on cms_content;
create trigger cms_content_snap after insert or update or delete on cms_content for each statement execute function cms_after_stmt();
drop trigger if exists cms_settings_snap on cms_settings;
create trigger cms_settings_snap after insert or update or delete on cms_settings for each statement execute function cms_after_stmt();
drop trigger if exists cms_products_snap on cms_products;
create trigger cms_products_snap after insert or update or delete on cms_products for each statement execute function cms_after_stmt();

drop trigger if exists cms_content_log on cms_content;
create trigger cms_content_log after insert or update or delete on cms_content for each row execute function cms_log_row();
drop trigger if exists cms_settings_log on cms_settings;
create trigger cms_settings_log after insert or update or delete on cms_settings for each row execute function cms_log_row();
drop trigger if exists cms_products_log on cms_products;
create trigger cms_products_log after insert or update or delete on cms_products for each row execute function cms_log_row();
drop trigger if exists cms_coupons_log on cms_coupons;
create trigger cms_coupons_log after insert or update or delete on cms_coupons for each row execute function cms_log_row();

-- 4. PUBLIC FUNCTIONS (used by the live site) --------------------------------
-- Checks a promo code. Returns the discount without ever exposing the coupon list.
create or replace function validate_promo(p_code text, p_subtotal numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c cms_coupons;
begin
  select * into c from cms_coupons where lower(code) = lower(trim(p_code));
  if not found or not c.active then return jsonb_build_object('ok', false, 'message', 'This promo code is not valid.'); end if;
  if c.starts_at is not null and now() < c.starts_at then return jsonb_build_object('ok', false, 'message', 'This promo code is not active yet.'); end if;
  if c.ends_at is not null and now() > c.ends_at then return jsonb_build_object('ok', false, 'message', 'This promo code has expired.'); end if;
  if c.usage_limit is not null and c.used >= c.usage_limit then return jsonb_build_object('ok', false, 'message', 'This promo code has reached its limit.'); end if;
  if p_subtotal < c.min_subtotal then return jsonb_build_object('ok', false, 'message', 'Minimum order of $' || c.min_subtotal || ' needed for this code.'); end if;
  return jsonb_build_object('ok', true, 'code', c.code, 'kind', c.kind, 'amount', c.amount);
end $$;

-- Saves a contact form message (the only thing visitors can write).
create or replace function submit_message(p_name text, p_email text, p_phone text, p_subject text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_email), '') = '' or coalesce(trim(p_body), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Please fill in your email and message.');
  end if;
  insert into cms_messages (name, email, phone, subject, body)
  values (left(p_name, 200), left(p_email, 200), left(p_phone, 100), left(p_subject, 300), left(p_body, 5000));
  return jsonb_build_object('ok', true);
end $$;

-- Lets the checkout count a coupon use (optional, call when an order is placed).
create or replace function use_promo(p_code text) returns void
language sql security definer set search_path = public as $$
  update cms_coupons set used = used + 1 where lower(code) = lower(trim(p_code));
$$;

grant execute on function validate_promo(text, numeric) to anon, authenticated;
grant execute on function submit_message(text, text, text, text, text) to anon, authenticated;
grant execute on function use_promo(text) to anon, authenticated;

-- Owner adds a team member who already has a login (created in Authentication > Users).
create or replace function cms_add_admin(p_email text, p_role text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not cms_can('owner') then return jsonb_build_object('ok', false, 'message', 'Only the owner can do this.'); end if;
  if p_role not in ('owner','admin','editor','viewer') then return jsonb_build_object('ok', false, 'message', 'Unknown role.'); end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return jsonb_build_object('ok', false, 'message', 'No login found for that email. Create it first in Supabase under Authentication > Users.'); end if;
  insert into cms_admins (user_id, email, role) values (uid, lower(trim(p_email)), p_role)
    on conflict (user_id) do update set role = excluded.role;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function cms_add_admin(text, text) to authenticated;

-- 5. SECURITY (who can read and write what) ------------------------------------
alter table cms_admins   enable row level security;
alter table cms_content  enable row level security;
alter table cms_settings enable row level security;
alter table cms_products enable row level security;
alter table cms_coupons  enable row level security;
alter table cms_messages enable row level security;
alter table cms_media    enable row level security;
alter table cms_history  enable row level security;
alter table cms_snapshot enable row level security;

do $$ declare t text; begin
  for t in select unnest(array['cms_admins','cms_content','cms_settings','cms_products','cms_coupons','cms_messages','cms_media','cms_history','cms_snapshot']) loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
  end loop;
end $$;

drop policy if exists snapshot_public_read on cms_snapshot;
create policy snapshot_public_read on cms_snapshot for select to anon, authenticated using (true);

drop policy if exists admins_self_read on cms_admins;
create policy admins_self_read on cms_admins for select to authenticated using (user_id = auth.uid() or cms_can('owner'));
drop policy if exists admins_owner_write on cms_admins;
create policy admins_owner_write on cms_admins for all to authenticated using (cms_can('owner')) with check (cms_can('owner'));

drop policy if exists content_read on cms_content;
create policy content_read on cms_content for select to authenticated using (cms_can('viewer'));
drop policy if exists content_write on cms_content;
create policy content_write on cms_content for all to authenticated using (cms_can('editor')) with check (cms_can('editor'));

drop policy if exists settings_read on cms_settings;
create policy settings_read on cms_settings for select to authenticated using (cms_can('viewer'));
drop policy if exists settings_write on cms_settings;
create policy settings_write on cms_settings for all to authenticated using (cms_can('admin')) with check (cms_can('admin'));

drop policy if exists products_read on cms_products;
create policy products_read on cms_products for select to authenticated using (cms_can('viewer'));
drop policy if exists products_write on cms_products;
create policy products_write on cms_products for all to authenticated using (cms_can('editor')) with check (cms_can('editor'));

drop policy if exists coupons_read on cms_coupons;
create policy coupons_read on cms_coupons for select to authenticated using (cms_can('viewer'));
drop policy if exists coupons_write on cms_coupons;
create policy coupons_write on cms_coupons for all to authenticated using (cms_can('admin')) with check (cms_can('admin'));

drop policy if exists messages_read on cms_messages;
create policy messages_read on cms_messages for select to authenticated using (cms_can('viewer'));
drop policy if exists messages_write on cms_messages;
create policy messages_write on cms_messages for all to authenticated using (cms_can('editor')) with check (cms_can('editor'));

drop policy if exists media_read on cms_media;
create policy media_read on cms_media for select to authenticated using (cms_can('viewer'));
drop policy if exists media_write on cms_media;
create policy media_write on cms_media for all to authenticated using (cms_can('editor')) with check (cms_can('editor'));

drop policy if exists history_read on cms_history;
create policy history_read on cms_history for select to authenticated using (cms_can('viewer'));

-- 6. FILE STORAGE (image uploads) ----------------------------------------------
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do update set public = true;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'media');
drop policy if exists media_editor_insert on storage.objects;
create policy media_editor_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and cms_can('editor'));
drop policy if exists media_editor_update on storage.objects;
create policy media_editor_update on storage.objects for update to authenticated using (bucket_id = 'media' and cms_can('editor'));
drop policy if exists media_editor_delete on storage.objects;
create policy media_editor_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and cms_can('editor'));

-- 7. FIRST ADMIN ---------------------------------------------------------------
-- Step A: In Supabase go to Authentication > Users > Add user, create your login (email + password).
-- Step B: Replace the email below with that same email and run ONLY this line:
--
-- insert into cms_admins (user_id, email, role) select id, email, 'owner' from auth.users where email = 'you@example.com';
--
-- (Further admins are added later inside the admin panel under Team.)

grant usage on schema public to anon, authenticated;
grant select on cms_snapshot to anon, authenticated;
grant select, insert, update, delete on cms_admins, cms_content, cms_settings, cms_products, cms_coupons, cms_messages, cms_media to authenticated;
grant select on cms_history to authenticated;
grant usage, select on all sequences in schema public to authenticated;
