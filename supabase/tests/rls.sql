-- Teste de permissões (RLS). Roda como postgres via execute_sql.
-- Sempre termina com a exceção 'RLS OK', que desfaz tudo (inclusive as linhas de teste em auth.users).
-- Qualquer outra mensagem de erro é uma falha.
do $$
declare
  emp constant text := 'fantastique-prime-2';
  id_corretor constant uuid := '00000000-0000-4000-8000-000000000001';
  id_inativo  constant uuid := '00000000-0000-4000-8000-000000000002';
  id_gerente  constant uuid := '00000000-0000-4000-8000-000000000003';
  n bigint;
  logs_antes bigint;
  claims text;
begin
  insert into auth.users (instance_id, id, email, aud, role) values
    ('00000000-0000-0000-0000-000000000000', id_corretor, 'teste-corretor@espelho3d.invalid', 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-000000000000', id_inativo,  'teste-inativo@espelho3d.invalid',  'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-000000000000', id_gerente,  'teste-gerente@espelho3d.invalid',  'authenticated', 'authenticated');
  if (select count(*) from public.profiles where id in (id_corretor, id_inativo, id_gerente)) <> 3 then
    raise exception 'FALHA: gatilho não criou os 3 perfis';
  end if;
  if (select role from public.profiles where id = id_corretor) <> 'corretor' then
    raise exception 'FALHA: papel padrão deveria ser corretor';
  end if;
  -- Cadastro sozinho não dá acesso: toda conta nova nasce inativa, e o e-mail do admin não vira admin sozinho.
  if exists (select 1 from public.profiles where id in (id_corretor, id_inativo, id_gerente) and ativo) then
    raise exception 'FALHA: conta nova deveria nascer inativa';
  end if;
  update public.profiles set ativo = true where id in (id_corretor, id_gerente);
  update public.profiles set role = 'gerente' where id = id_gerente;
  select count(*) into logs_antes from public.status_log;

  -- anon
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.unit_prices where empreendimento = emp;
  if n <> 432 then raise exception 'FALHA: anon deveria ler 432 preços, leu %', n; end if;
  select count(*) into n from public.unit_status where empreendimento = emp;
  if n <> 0 then raise exception 'FALHA: anon não pode ler situação, leu %', n; end if;
  begin
    update public.unit_prices set venda = 1 where empreendimento = emp and torre = 1 and unidade = 101;
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'FALHA: anon alterou preço'; end if;
  begin
    select count(*) into n from public.ultima_atualizacao(emp);
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'FALHA: ultima_atualizacao respondeu para anon'; end if;
  execute 'reset role';

  -- corretor ativo
  claims := json_build_object('sub', id_corretor, 'role', 'authenticated')::text;
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role authenticated';
  select count(*) into n from public.unit_status where empreendimento = emp;
  if n <> 432 then raise exception 'FALHA: corretor ativo deveria ler 432 situações, leu %', n; end if;
  begin
    update public.unit_status set status = 'R' where empreendimento = emp and torre = 1 and unidade = 101;
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'FALHA: corretor alterou situação'; end if;
  select count(*) into n from public.ultima_atualizacao(emp);
  if n <> 1 then raise exception 'FALHA: ultima_atualizacao deveria responder ao corretor ativo'; end if;
  execute 'reset role';

  -- corretor inativo
  claims := json_build_object('sub', id_inativo, 'role', 'authenticated')::text;
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role authenticated';
  select count(*) into n from public.unit_status where empreendimento = emp;
  if n <> 0 then raise exception 'FALHA: corretor inativo leu % situações', n; end if;
  execute 'reset role';

  -- conferência sem mudança: só gerente registra, e ela conta como a última atualização
  claims := json_build_object('sub', id_corretor, 'role', 'authenticated')::text;
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role authenticated';
  begin
    insert into public.conferencias (empreendimento) values (emp);
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'FALHA: corretor registrou conferência'; end if;
  execute 'reset role';
  claims := json_build_object('sub', id_gerente, 'role', 'authenticated')::text;
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role authenticated';
  insert into public.conferencias (empreendimento) values (emp);
  execute 'reset role';
  claims := json_build_object('sub', id_corretor, 'role', 'authenticated')::text;
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role authenticated';
  if (select por from public.ultima_atualizacao(emp)) is distinct from 'teste-gerente@espelho3d.invalid' then
    raise exception 'FALHA: conferência do gerente não virou a última atualização';
  end if;
  execute 'reset role';

  -- gerente
  claims := json_build_object('sub', id_gerente, 'role', 'authenticated')::text;
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role authenticated';
  update public.unit_status set status = 'R' where empreendimento = emp and torre = 1 and unidade = 101;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHA: gerente não conseguiu alterar situação'; end if;
  update public.unit_prices set venda = 300000 where empreendimento = emp and torre = 1 and unidade = 102;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHA: gerente não conseguiu alterar preço'; end if;
  execute 'reset role';

  select count(*) into n from public.status_log;
  if n <> logs_antes + 1 then raise exception 'FALHA: alteração do gerente não gerou histórico'; end if;
  if (select updated_by from public.unit_status where empreendimento = emp and torre = 1 and unidade = 101) <> id_gerente then
    raise exception 'FALHA: updated_by não registrou o gerente';
  end if;

  raise exception 'RLS OK';
end $$;
