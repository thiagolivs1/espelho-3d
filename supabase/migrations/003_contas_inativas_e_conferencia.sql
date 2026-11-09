-- 1) Cadastro sozinho não dá acesso: toda conta nova nasce como corretor INATIVO.
--    Ativar contas e promover gerente/admin é feito pelo administrador (SQL ou, na Fase 2, pela tela do gerente).
--    O e-mail do administrador não ganha papel nenhum automaticamente.
alter table public.profiles alter column ativo set default false;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) Conferência sem mudança: o gerente confirma que conferiu a disponibilidade no dia.
create table public.conferencias (
  id bigserial primary key,
  empreendimento text not null,
  em timestamptz not null default now(),
  por uuid
);

create function public.stamp_conferencia() returns trigger
language plpgsql set search_path = public as $$
begin
  new.em := now();
  new.por := auth.uid();
  return new;
end $$;
revoke execute on function public.stamp_conferencia() from public, anon, authenticated;

create trigger conferencias_stamp before insert on public.conferencias
  for each row execute function public.stamp_conferencia();

alter table public.conferencias enable row level security;
create policy "gestão registra conferência" on public.conferencias for insert to authenticated
  with check (public.my_role() in ('admin', 'gerente'));
create policy "gestão lê conferências" on public.conferencias for select to authenticated
  using (public.my_role() in ('admin', 'gerente'));

-- A última atualização passa a ser a mais recente entre alteração de situação e conferência.
create or replace function public.ultima_atualizacao(p_emp text) returns table (em timestamptz, por text)
language sql stable security definer set search_path = public as $$
  select x.em, p.email
  from (
    select s.updated_at as em, s.updated_by as por from public.unit_status s where s.empreendimento = p_emp
    union all
    select c.em, c.por from public.conferencias c where c.empreendimento = p_emp
  ) x
  left join public.profiles p on p.id = x.por
  where public.my_role() is not null
  order by x.em desc, (x.por is not null) desc
  limit 1
$$;
