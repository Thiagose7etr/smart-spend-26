
-- ============ ROLES / PROFILES / SETTINGS ============

create type public.app_role as enum ('admin', 'editor', 'viewer');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- app_settings (singleton)
create table public.app_settings (
  id int primary key default 1,
  max_accounts int not null default 20,
  require_approval boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
insert into public.app_settings (id, max_accounts, require_approval) values (1, 20, true);

-- user_tab_permissions
create table public.user_tab_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tab text not null,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, tab)
);
grant select, insert, update, delete on public.user_tab_permissions to authenticated;
grant all on public.user_tab_permissions to service_role;
alter table public.user_tab_permissions enable row level security;

-- ============ HELPERS (SECURITY DEFINER) ============

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_active(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status from public.profiles where id = _user_id) = 'active', false);
$$;

create or replace function public.can_edit_tab(_user_id uuid, _tab text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active(_user_id) and (
    public.has_role(_user_id, 'admin')
    or public.has_role(_user_id, 'editor')
    or exists (
      select 1 from public.user_tab_permissions
      where user_id = _user_id and tab = _tab and can_edit = true
    )
  );
$$;

-- ============ POLICIES ============

-- profiles
create policy "profiles select" on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "profiles update self name" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles admin update" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "profiles admin delete" on public.profiles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "roles select" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "roles admin insert" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "roles admin delete" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- app_settings
create policy "settings select" on public.app_settings for select to authenticated using (true);
create policy "settings admin update" on public.app_settings for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- user_tab_permissions
create policy "perms select" on public.user_tab_permissions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "perms admin insert" on public.user_tab_permissions for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "perms admin update" on public.user_tab_permissions for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "perms admin delete" on public.user_tab_permissions for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ============ NEW USER TRIGGER (email domain, limit, role bootstrap) ============

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_domain text := split_part(v_email, '@', 2);
  v_is_admin boolean := (v_email = 'thiagovirtualy.tr@gmail.com');
  v_limit int;
  v_require_approval boolean;
  v_count int;
  v_status text;
begin
  if not v_is_admin and v_domain <> 'translix.com.br' then
    raise exception 'Apenas e-mails @translix.com.br podem se cadastrar.';
  end if;

  select max_accounts, require_approval into v_limit, v_require_approval
    from public.app_settings where id = 1;

  select count(*) into v_count from public.profiles;
  if not v_is_admin and v_count >= v_limit then
    raise exception 'Limite de contas atingido. Contate o administrador.';
  end if;

  if v_is_admin then
    v_status := 'active';
  elsif v_require_approval then
    v_status := 'pending';
  else
    v_status := 'active';
  end if;

  insert into public.profiles (id, email, full_name, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), v_status);

  if v_is_admin then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'viewer') on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger update_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ============ LOCK DOWN EXISTING DATA TABLES ============

revoke all on public.combustivel from anon;
revoke all on public.compras from anon;
revoke all on public.frotas from anon;
revoke all on public.guincho from anon;
revoke all on public.metas from anon;

grant select, insert, update, delete on public.combustivel to authenticated;
grant select, insert, update, delete on public.compras to authenticated;
grant select, insert, update, delete on public.frotas to authenticated;
grant select, insert, update, delete on public.guincho to authenticated;
grant select, insert, update, delete on public.metas to authenticated;

drop policy if exists "Public full access combustivel" on public.combustivel;
drop policy if exists "Public full access compras" on public.compras;
drop policy if exists "Public full access frotas" on public.frotas;
drop policy if exists "Public full access guincho" on public.guincho;
drop policy if exists "Public full access metas" on public.metas;

-- combustivel
create policy "combustivel select" on public.combustivel for select to authenticated using (public.is_active(auth.uid()));
create policy "combustivel insert" on public.combustivel for insert to authenticated with check (public.can_edit_tab(auth.uid(),'combustivel'));
create policy "combustivel update" on public.combustivel for update to authenticated using (public.can_edit_tab(auth.uid(),'combustivel')) with check (public.can_edit_tab(auth.uid(),'combustivel'));
create policy "combustivel delete" on public.combustivel for delete to authenticated using (public.can_edit_tab(auth.uid(),'combustivel'));

-- compras
create policy "compras select" on public.compras for select to authenticated using (public.is_active(auth.uid()));
create policy "compras insert" on public.compras for insert to authenticated with check (public.can_edit_tab(auth.uid(),'compras'));
create policy "compras update" on public.compras for update to authenticated using (public.can_edit_tab(auth.uid(),'compras')) with check (public.can_edit_tab(auth.uid(),'compras'));
create policy "compras delete" on public.compras for delete to authenticated using (public.can_edit_tab(auth.uid(),'compras'));

-- frotas
create policy "frotas select" on public.frotas for select to authenticated using (public.is_active(auth.uid()));
create policy "frotas insert" on public.frotas for insert to authenticated with check (public.can_edit_tab(auth.uid(),'frotas'));
create policy "frotas update" on public.frotas for update to authenticated using (public.can_edit_tab(auth.uid(),'frotas')) with check (public.can_edit_tab(auth.uid(),'frotas'));
create policy "frotas delete" on public.frotas for delete to authenticated using (public.can_edit_tab(auth.uid(),'frotas'));

-- guincho
create policy "guincho select" on public.guincho for select to authenticated using (public.is_active(auth.uid()));
create policy "guincho insert" on public.guincho for insert to authenticated with check (public.can_edit_tab(auth.uid(),'guincho'));
create policy "guincho update" on public.guincho for update to authenticated using (public.can_edit_tab(auth.uid(),'guincho')) with check (public.can_edit_tab(auth.uid(),'guincho'));
create policy "guincho delete" on public.guincho for delete to authenticated using (public.can_edit_tab(auth.uid(),'guincho'));

-- metas
create policy "metas select" on public.metas for select to authenticated using (public.is_active(auth.uid()));
create policy "metas insert" on public.metas for insert to authenticated with check (public.can_edit_tab(auth.uid(),'metas'));
create policy "metas update" on public.metas for update to authenticated using (public.can_edit_tab(auth.uid(),'metas')) with check (public.can_edit_tab(auth.uid(),'metas'));
create policy "metas delete" on public.metas for delete to authenticated using (public.can_edit_tab(auth.uid(),'metas'));
