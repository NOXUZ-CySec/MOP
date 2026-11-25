-- Template público: copie para fora do repositório e revise antes de executar.
-- Requer o esquema do MOP e uma conta confirmada no Supabase Auth.
-- Concede admin com acesso a todos os condomínios do workspace escolhido.
begin;
do $$
declare
  target_email text := '__ADMIN_EMAIL__';
  target_workspace constant uuid := '00000000-0000-4000-8000-000000000001';
  target_user uuid;
begin
  if position('@' in target_email) < 2 then
    raise exception 'Preencha o e-mail autorizado na cópia local deste template.';
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
      and (role <> 'admin' or condos is not null)
  ) then
    raise exception 'Vínculo existente divergente. Use o fluxo autorizado de gestão de acessos.';
  end if;
  insert into public.mop_members(workspace_id,user_id,role,condos)
  values(target_workspace,target_user,'admin',null)
  on conflict(workspace_id,user_id) do nothing;
end $$;
commit;
