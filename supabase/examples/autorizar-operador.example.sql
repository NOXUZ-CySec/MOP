-- Template público: copie para fora do repositório e revise antes de executar.
-- Requer conta confirmada e escopo explícito; não modifica vínculos divergentes.
begin;
do $$
declare
  target_email text := '__OPERATOR_EMAIL__';
  target_workspace constant uuid := '00000000-0000-4000-8000-000000000001';
  target_condos text[] := array['__CONDOMINIO__'];
  target_user uuid;
begin
  if position('@' in target_email) < 2
     or target_condos is null or cardinality(target_condos) = 0
     or exists (select 1 from unnest(target_condos) c
                where c is null or btrim(c) = '' or (left(c,2) = '__' and right(c,2) = '__')) then
    raise exception 'Preencha a conta e os condomínios autorizados na cópia local deste template.';
  end if;
  if not exists (select 1 from public.mop_workspaces where id = target_workspace) then
    raise exception 'Workspace não encontrado. Confira o projeto e o esquema antes de prosseguir.';
  end if;
  select id into target_user
    from auth.users
    where lower(email) = lower(btrim(target_email)) and email_confirmed_at is not null;
  if target_user is null then
    raise exception 'Conta confirmada não encontrada no Auth.';
  end if;
  if exists (
    select 1 from public.mop_members
    where workspace_id = target_workspace and user_id = target_user
      and (role <> 'operator' or condos is distinct from target_condos)
  ) then
    raise exception 'Vínculo existente divergente. Use o fluxo autorizado de gestão de acessos.';
  end if;
  insert into public.mop_members(workspace_id,user_id,role,condos)
  values(target_workspace,target_user,'operator',target_condos)
  on conflict(workspace_id,user_id) do nothing;
end $$;
commit;
