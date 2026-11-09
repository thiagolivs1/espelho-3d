-- my_role() e ultima_atualizacao() só fazem sentido para quem está logado.
-- As políticas de unit_status são "to authenticated", então anon nunca precisa de my_role().
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.ultima_atualizacao(text) from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.ultima_atualizacao(text) to authenticated;
