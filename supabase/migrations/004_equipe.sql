-- Equipe: gerente ativa/desativa corretores; admin também define quem é gerente.
-- Ninguém mexe no próprio acesso nem no do admin. Contas novas continuam nascendo inativas (003);
-- a Edge Function criar-corretor ativa a conta que o gerente cria.
create function public.definir_acesso(p_id uuid, p_ativo boolean, p_role text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  quem text := public.my_role();
  alvo text;
begin
  if quem is null or quem not in ('admin', 'gerente') then
    raise exception 'Sem permissão para alterar acessos.';
  end if;
  if p_id = auth.uid() then
    raise exception 'Você não pode alterar o próprio acesso.';
  end if;
  select role into alvo from public.profiles where id = p_id;
  if alvo is null then raise exception 'Conta não encontrada.'; end if;
  if alvo = 'admin' then raise exception 'O acesso do administrador não pode ser alterado aqui.'; end if;
  if p_role is not null and p_role not in ('gerente', 'corretor') then
    raise exception 'Papel inválido.';
  end if;
  if quem = 'gerente' and (alvo <> 'corretor' or coalesce(p_role, 'corretor') <> 'corretor') then
    raise exception 'Gerente só ativa ou desativa corretores.';
  end if;
  update public.profiles set ativo = p_ativo, role = coalesce(p_role, role) where id = p_id;
end $$;

revoke execute on function public.definir_acesso(uuid, boolean, text) from public, anon;
grant execute on function public.definir_acesso(uuid, boolean, text) to authenticated;
