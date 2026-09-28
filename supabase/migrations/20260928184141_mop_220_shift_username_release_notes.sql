alter table public.mop_members add column if not exists username text;
create unique index if not exists mop_members_username_uq on public.mop_members(lower(username)) where username is not null;

alter table public.mop_members drop constraint if exists mop_members_username_check;
alter table public.mop_members add constraint mop_members_username_check check (
  username is null or (
    length(username) between 3 and 40
    and username = lower(username)
    and username ~ '^[a-z0-9][a-z0-9._-]*$'
  )
);

create or replace function public.mop_resolve_login(p_login text) returns text
language sql security definer set search_path='' as $$
  select u.email
  from public.mop_members m
  join auth.users u on u.id=m.user_id
  where lower(m.username)=lower(trim(p_login))
  limit 1
$$;

revoke all on function public.mop_resolve_login(text) from public;
grant execute on function public.mop_resolve_login(text) to anon, authenticated;

create or replace function public.mop_list_members(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not mop_private.mop_is_admin(p_workspace) then raise exception 'Somente administradores.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'username',m.username,'display_name',coalesce(m.display_name,'Operador '||left(m.user_id::text,8)),'role',m.role,'condos',m.condos)),'[]'::jsonb) from public.mop_members m where m.workspace_id=p_workspace);
end $$;

create or replace function public.mop_set_operator_220(p_workspace uuid,p_user_id uuid,p_username text,p_display_name text,p_role text,p_condos text[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare previous public.mop_members; normalized text;
begin
 if not mop_private.mop_is_admin(p_workspace) then raise exception 'Somente administradores.' using errcode='42501'; end if;
 normalized:=lower(trim(p_username));
 if normalized is null or length(normalized) not between 3 and 40 or normalized !~ '^[a-z0-9][a-z0-9._-]*$' then raise exception 'Usuário inválido.'; end if;
 if exists(select 1 from public.mop_members where lower(username)=normalized and user_id<>p_user_id) then raise exception 'Este usuário já está em uso.'; end if;
 if p_display_name is null or length(trim(p_display_name)) not between 1 and 100 or position('@' in p_display_name)>0 then raise exception 'Informe um nome de exibição, sem e-mail.'; end if;
 if p_role is null or p_role not in ('admin','supervisor','operator','viewer') then raise exception 'Perfil inválido.'; end if;
 if p_role='admin' and p_condos is not null then raise exception 'Administradores precisam de acesso integral.'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Cadastre primeiro a conta na central.'; end if;
 select * into previous from public.mop_members where workspace_id=p_workspace and user_id=p_user_id;
 if p_user_id=auth.uid() and (previous.role is distinct from p_role or previous.condos is distinct from p_condos) then raise exception 'Outro administrador deve alterar seu acesso.'; end if;
 insert into public.mop_members(workspace_id,user_id,username,display_name,role,condos) values(p_workspace,p_user_id,normalized,trim(p_display_name),p_role,p_condos)
 on conflict(workspace_id,user_id) do update set username=excluded.username,display_name=excluded.display_name,role=excluded.role,condos=excluded.condos,access_version=mop_members.access_version+1;
 return true;
end $$;
revoke all on function public.mop_list_members(uuid),public.mop_set_operator_220(uuid,uuid,text,text,text,text[]) from public,anon;
grant execute on function public.mop_list_members(uuid),public.mop_set_operator_220(uuid,uuid,text,text,text,text[]) to authenticated;
