-- Included by the setup generator in mop.sql; also safe to run after the base schema.
alter table public.mop_members add column if not exists role text not null default 'operator' check(role in ('operator','supervisor','admin','viewer'));
alter table public.mop_members add column if not exists condos text[];
alter table public.mop_members add column if not exists access_version integer not null default 1;

-- Definer helpers are necessary to inspect membership without recursive RLS.
-- Every helper is scoped to auth.uid(); no caller-supplied identity is accepted.
create index if not exists mop_members_user on public.mop_members(user_id,workspace_id);
create schema if not exists mop_private;
grant usage on schema mop_private to authenticated;
create or replace function mop_private.mop_can_condo(w uuid,c text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.mop_members m where m.workspace_id=w and m.user_id=auth.uid() and (m.condos is null or c=any(m.condos)));
$$;
create or replace function mop_private.mop_is_admin(w uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.mop_members m where m.workspace_id=w and m.user_id=auth.uid() and m.role='admin');
$$;
create or replace function mop_private.mop_can_record(w uuid,k text,p jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare scope text[]; parent jsonb;
begin
 if auth.uid() is null then return false; end if;
 select condos into scope from public.mop_members where workspace_id=w and user_id=auth.uid();
 if not found then return false; end if;
 if scope is null then return true; end if;
 if k in ('events','attachments') then
   select payload into parent from public.mop_records where workspace_id=w and id=(p->>'item_id')::uuid and kind='items';
   return coalesce(parent->>'condo'=any(scope),false);
 elsif k='handovers' then
   return coalesce(p->>'condo'=any(scope),false) or (jsonb_typeof(p->'snapshot')='array' and jsonb_array_length(p->'snapshot')>0 and not exists(select 1 from jsonb_array_elements(p->'snapshot') x where not coalesce(x->>'condo'=any(scope),false)));
 end if;
 return coalesce(p->>'condo'=any(scope),false);
end $$;
revoke all on function mop_private.mop_can_condo(uuid,text),mop_private.mop_is_admin(uuid),mop_private.mop_can_record(uuid,text,jsonb) from public,anon;
grant execute on function mop_private.mop_can_condo(uuid,text),mop_private.mop_is_admin(uuid),mop_private.mop_can_record(uuid,text,jsonb) to authenticated;
drop policy if exists mop_read_records on public.mop_records;
create policy mop_read_records on public.mop_records for select to authenticated using(mop_private.mop_can_record(workspace_id,kind,payload));

create or replace function public.mop_list_members(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not mop_private.mop_is_admin(p_workspace) then raise exception 'Somente administradores.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('email',u.email,'role',m.role,'condos',m.condos)),'[]'::jsonb) from public.mop_members m join auth.users u on u.id=m.user_id where m.workspace_id=p_workspace);
end $$;
create or replace function public.mop_set_member(p_workspace uuid,p_email text,p_role text,p_condos text[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if not mop_private.mop_is_admin(p_workspace) then raise exception 'Somente administradores.' using errcode='42501'; end if;
 if p_role not in ('operator','supervisor','admin','viewer') or p_role is null then raise exception 'Perfil inválido.'; end if;
 select id into target from auth.users where lower(email)=lower(trim(p_email));
 if target is null then raise exception 'Cadastre primeiro esta conta em Authentication.'; end if;
 if target=auth.uid() then raise exception 'Outro administrador deve alterar seu acesso.'; end if;
 if p_role='admin' and p_condos is not null then raise exception 'Administradores precisam de acesso integral.'; end if;
 if p_condos is not null and (cardinality(p_condos)>100 or exists(select 1 from unnest(p_condos) x where x is null or length(trim(x))=0 or length(x)>100)) then raise exception 'Condomínios inválidos.'; end if;
 insert into public.mop_members(workspace_id,user_id,role,condos) values(p_workspace,target,p_role,p_condos)
 on conflict(workspace_id,user_id) do update set role=excluded.role,condos=excluded.condos,access_version=mop_members.access_version+1;
 return true;
end $$;
revoke all on function public.mop_list_members(uuid),public.mop_set_member(uuid,text,text,text[]) from public,anon;
grant execute on function public.mop_list_members(uuid),public.mop_set_member(uuid,text,text,text[]) to authenticated;
