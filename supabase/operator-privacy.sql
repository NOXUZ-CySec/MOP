-- Operator names are managed by administrators, never inferred from email.
alter table public.mop_members add column if not exists display_name text;
alter table public.mop_members drop constraint if exists mop_member_display_name;
alter table public.mop_members add constraint mop_member_display_name check(display_name is null or (length(trim(display_name)) between 1 and 100 and position('@' in display_name)=0));

create or replace function mop_private.mop_private_payload(w uuid,v jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; k text; x jsonb; f text; identity_key text; person uuid; person_name text;
begin
 if jsonb_typeof(v)='string' then return to_jsonb(regexp_replace(v#>>'{}','[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+','[e-mail protegido]','g')); end if;
 if jsonb_typeof(v)='array' then select coalesce(jsonb_agg(mop_private.mop_private_payload(w,value)),'[]'::jsonb) into result from jsonb_array_elements(v);return result;end if;
 if jsonb_typeof(v)<>'object' then return v;end if;
 result='{}'::jsonb;
 for k,x in select * from jsonb_each(v) loop
   if k<>'email' then result=result||jsonb_build_object(k,case when k='content' then x else mop_private.mop_private_payload(w,x) end);end if;
 end loop;
 if v ? 'user_id' then
   select coalesce(m.display_name,'Operador '||left(m.user_id::text,8)) into person_name from public.mop_members m where m.workspace_id=w and m.user_id::text=v->>'user_id';
   result=result||jsonb_build_object('display_name',coalesce(person_name,'Operador '||left(v->>'user_id',8)));
 end if;
 foreach f in array array['created_by','updated_by','deleted_by','actor','incoming','outgoing'] loop
   identity_key=case f when 'created_by' then 'created_identity' when 'updated_by' then 'updated_identity' when 'deleted_by' then 'deleted_identity' when 'actor' then 'author' else f||'_identity' end;
   if position('@' in coalesce(v->>f,''))>0 then
     person=null;person_name=null;
     select m.user_id,coalesce(m.display_name,'Operador '||left(m.user_id::text,8)) into person,person_name from public.mop_members m join auth.users u on u.id=m.user_id where m.workspace_id=w and lower(u.email)=lower(v->>f) limit 1;
     result=result||jsonb_build_object(f,coalesce(person_name,'Operador'));
     if person is not null then result=result||jsonb_build_object(identity_key,jsonb_build_object('user_id',person,'display_name',person_name));end if;
   elsif result->identity_key ? 'display_name' and v ? f then result=jsonb_set(result,array[f],result->identity_key->'display_name');
   end if;
 end loop;
 return result;
end $$;
revoke all on function mop_private.mop_private_payload(uuid,jsonb) from public,anon,authenticated;

create or replace function public.mop_list_members(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not mop_private.mop_is_admin(p_workspace) then raise exception 'Somente administradores.' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',coalesce(m.display_name,'Operador '||left(m.user_id::text,8)),'role',m.role,'condos',m.condos)),'[]'::jsonb) from public.mop_members m where m.workspace_id=p_workspace);
end $$;

create or replace function public.mop_set_operator(p_workspace uuid,p_user_id uuid,p_display_name text,p_role text,p_condos text[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare previous public.mop_members;
begin
 if not mop_private.mop_is_admin(p_workspace) then raise exception 'Somente administradores.' using errcode='42501';end if;
 if p_display_name is null or length(trim(p_display_name)) not between 1 and 100 or position('@' in p_display_name)>0 then raise exception 'Informe um nome de exibição, sem e-mail.';end if;
 if p_role is null or p_role not in ('admin','supervisor','operator','viewer') then raise exception 'Perfil inválido.';end if;
 if p_role='admin' and p_condos is not null then raise exception 'Administradores precisam de acesso integral.';end if;
 if p_condos is not null and (cardinality(p_condos)>100 or exists(select 1 from unnest(p_condos) x where x is null or length(trim(x))=0 or length(x)>100)) then raise exception 'Condomínios inválidos.';end if;
 select * into previous from public.mop_members where workspace_id=p_workspace and user_id=p_user_id;
 if p_user_id=auth.uid() and (previous.role is distinct from p_role or previous.condos is distinct from p_condos) then raise exception 'Outro administrador deve alterar seu acesso.';end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Cadastre primeiro a conta na central.';end if;
 insert into public.mop_members(workspace_id,user_id,display_name,role,condos) values(p_workspace,p_user_id,trim(p_display_name),p_role,p_condos)
 on conflict(workspace_id,user_id) do update set display_name=excluded.display_name,role=excluded.role,condos=excluded.condos,access_version=mop_members.access_version+1;
 return true;
end $$;
revoke all on function public.mop_list_members(uuid),public.mop_set_operator(uuid,uuid,text,text,text[]) from public,anon;
grant execute on function public.mop_list_members(uuid),public.mop_set_operator(uuid,uuid,text,text,text[]) to authenticated;

-- Sanitize existing records under the same workspace locks used by writers.
-- Revisions advance so connected stations receive the privacy correction.
do $$
declare w record; r record; sanitized jsonb; rev bigint; has_guard boolean;
begin
 select exists(select 1 from pg_trigger where tgrelid='public.mop_records'::regclass and tgname='mop_guard_record_removal') into has_guard;
 if has_guard then alter table public.mop_records disable trigger mop_guard_record_removal;end if;
 for w in select id from public.mop_workspaces order by id for update loop
   for r in select id,payload from public.mop_records where workspace_id=w.id loop
     sanitized=mop_private.mop_private_payload(w.id,r.payload);
     if sanitized is distinct from r.payload then
       update public.mop_workspaces set revision=revision+1 where id=w.id returning revision into rev;
       update public.mop_records set payload=sanitized,revision=rev,version=version+1 where workspace_id=w.id and id=r.id;
     end if;
   end loop;
   update public.mop_operations set payload=mop_private.mop_private_payload(w.id,payload),result=mop_private.mop_private_payload(w.id,result) where workspace_id=w.id;
 end loop;
 if has_guard then alter table public.mop_records enable trigger mop_guard_record_removal;end if;
end $$;
