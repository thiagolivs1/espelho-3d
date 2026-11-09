-- Espelho 3D · esquema inicial
-- Preços: leitura pública. Situação de venda: só usuários logados e ativos. Escrita: gerente e admin.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'corretor' check (role in ('admin', 'gerente', 'corretor')),
  ativo boolean not null default true
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Versão original dava 'admin' a um e-mail fixo; substituída na 003 (conta nova = corretor inativo).
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and ativo
$$;

create table public.unit_prices (
  empreendimento text not null,
  torre int not null,
  unidade int not null,
  venda numeric(12, 2) not null check (venda > 0),
  avaliacao numeric(12, 2),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (empreendimento, torre, unidade)
);

create table public.unit_status (
  empreendimento text not null,
  torre int not null,
  unidade int not null,
  status char(1) not null check (status in ('D', 'R', 'V', 'B')),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (empreendimento, torre, unidade)
);

create table public.status_log (
  id bigserial primary key,
  empreendimento text not null,
  torre int not null,
  unidade int not null,
  status_antes char(1),
  status_depois char(1) not null,
  changed_at timestamptz not null default now(),
  changed_by uuid
);

create function public.stamp_update() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger unit_prices_stamp before insert or update on public.unit_prices
  for each row execute function public.stamp_update();
create trigger unit_status_stamp before insert or update on public.unit_status
  for each row execute function public.stamp_update();

create function public.log_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.status_log (empreendimento, torre, unidade, status_antes, status_depois, changed_by)
    values (new.empreendimento, new.torre, new.unidade, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger unit_status_log after update on public.unit_status
  for each row execute function public.log_status_change();

create function public.ultima_atualizacao(p_emp text) returns table (em timestamptz, por text)
language sql stable security definer set search_path = public as $$
  select s.updated_at, p.email
  from public.unit_status s
  left join public.profiles p on p.id = s.updated_by
  where s.empreendimento = p_emp and public.my_role() is not null
  order by s.updated_at desc
  limit 1
$$;

alter table public.profiles enable row level security;
alter table public.unit_prices enable row level security;
alter table public.unit_status enable row level security;
alter table public.status_log enable row level security;

create policy "perfil próprio ou equipe de gestão" on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() in ('admin', 'gerente'));

create policy "preços públicos" on public.unit_prices for select to anon, authenticated using (true);
create policy "gestão altera preços" on public.unit_prices for update to authenticated
  using (public.my_role() in ('admin', 'gerente')) with check (public.my_role() in ('admin', 'gerente'));
create policy "gestão insere preços" on public.unit_prices for insert to authenticated
  with check (public.my_role() in ('admin', 'gerente'));

create policy "situação só para logados ativos" on public.unit_status for select to authenticated
  using (public.my_role() is not null);
create policy "gestão altera situação" on public.unit_status for update to authenticated
  using (public.my_role() in ('admin', 'gerente')) with check (public.my_role() in ('admin', 'gerente'));
create policy "gestão insere situação" on public.unit_status for insert to authenticated
  with check (public.my_role() in ('admin', 'gerente'));

create policy "histórico para gestão" on public.status_log for select to authenticated
  using (public.my_role() in ('admin', 'gerente'));

-- Funções internas não precisam ficar expostas como RPC para anon.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_status_change() from public, anon, authenticated;
revoke execute on function public.stamp_update() from public, anon, authenticated;
