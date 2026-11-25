-- Execute no SQL Editor do seu projeto Supabase. Não apaga dados existentes.
begin;
create table if not exists public.mop_workspaces (
  id uuid primary key, name text not null, revision bigint not null default 0
);
create table if not exists public.mop_members (
  workspace_id uuid not null references public.mop_workspaces(id),
  user_id uuid not null references auth.users(id),
  primary key(workspace_id,user_id)
);
create table if not exists public.mop_records (
  workspace_id uuid not null references public.mop_workspaces(id),
  id uuid not null, kind text not null check(kind in ('items','events','handovers')),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  version bigint not null, revision bigint not null,
  updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now(),
  primary key(workspace_id,id)
);
create index if not exists mop_records_revision on public.mop_records(workspace_id,revision);
create index if not exists mop_records_updated_by_idx on public.mop_records(updated_by);
create table if not exists public.mop_operations (
  workspace_id uuid not null references public.mop_workspaces(id),
  op_id uuid not null, record_id uuid not null, kind text not null, payload jsonb not null,
  result jsonb not null, user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key(workspace_id,op_id)
);
create index if not exists mop_operations_user_id_idx on public.mop_operations(user_id);
alter table public.mop_workspaces enable row level security;
alter table public.mop_members enable row level security;
alter table public.mop_records enable row level security;
alter table public.mop_operations enable row level security;
drop policy if exists mop_own_membership on public.mop_members;
create policy mop_own_membership on public.mop_members for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists mop_read_records on public.mop_records;
create policy mop_read_records on public.mop_records for select to authenticated using(
  exists(select 1 from public.mop_members m where m.workspace_id=mop_records.workspace_id and m.user_id=auth.uid())
);
revoke all on public.mop_workspaces,public.mop_members,public.mop_records,public.mop_operations from anon,authenticated;
grant select on public.mop_members,public.mop_records to authenticated;

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
create policy mop_read_records on public.mop_records for select to authenticated using((select mop_private.mop_can_record(workspace_id,kind,payload)));

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

alter table public.mop_records drop constraint if exists mop_records_kind_check;
alter table public.mop_records add constraint mop_records_kind_check check(kind in ('items','events','handovers','templates','runs','receipts','attachments'));
create unique index if not exists mop_template_key on public.mop_records(workspace_id,(payload->>'key')) where kind='templates';
create unique index if not exists mop_run_slot on public.mop_records(workspace_id,(payload->>'template_key'),(payload->>'slot')) where kind='runs';

-- All writers hold the workspace lock until commit. Revision cursors therefore
-- cannot skip a transaction that commits after a newer transaction.
create or replace function public.mop_push(p_workspace uuid,p_op uuid,p_id uuid,p_kind text,p_base bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.mop_records; old_op public.mop_operations; result jsonb; rev bigint; member public.mop_members; parent jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.mop_members where workspace_id=p_workspace and user_id=auth.uid()) then
    raise exception 'Operador sem acesso a esta central.' using errcode='42501';
  end if;
  select * into member from public.mop_members where workspace_id=p_workspace and user_id=auth.uid();
  if member.role='viewer' or not mop_private.mop_can_record(p_workspace,p_kind,p_payload) then raise exception 'Alteração fora do seu acesso.' using errcode='42501'; end if;
  if p_kind='templates' and member.role not in ('supervisor','admin') then raise exception 'Somente supervisores podem configurar rotinas.' using errcode='42501'; end if;
  perform 1 from public.mop_workspaces where id=p_workspace for update;
  select * into old_op from public.mop_operations where workspace_id=p_workspace and op_id=p_op;
  if found then
    if old_op.record_id<>p_id or old_op.kind<>p_kind or old_op.payload<>p_payload then raise exception 'Operação reutilizada com conteúdo diferente.'; end if;
    return old_op.result;
  end if;
  if p_id is null or p_op is null or p_kind is null or p_base is null or p_base<0 or p_payload is null
    or p_kind not in ('items','events','handovers','templates','runs','receipts','attachments') or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1048576 then
    raise exception 'Alteração inválida ou maior que 1 MB.';
  end if;
  if p_payload ? 'id' then raise exception 'Identificador local não deve ser enviado.'; end if;
  if p_kind='items' and (coalesce(p_payload->>'protocol','')!~'^MOP-[0-9]{8}-[A-Z0-9]{6,32}$'
      or coalesce(p_payload->>'status','') not in ('Pendente','Em andamento','Aguardando resposta','Aguardando manutenção','Resolvido')
      or coalesce(p_payload->>'subject','')='' or coalesce(p_payload->>'condo','')='') then raise exception 'Registro incompleto.'; end if;
  if p_kind in ('events','attachments') and not exists(select 1 from public.mop_records where workspace_id=p_workspace and id=(p_payload->>'item_id')::uuid and kind='items') then
    raise exception 'Registro do histórico ainda não sincronizado.';
  end if;
  if p_kind='handovers' and (jsonb_typeof(p_payload->'open_ids') is distinct from 'array'
      or (p_payload ? 'snapshot' and jsonb_typeof(p_payload->'snapshot')<>'array')) then raise exception 'Passagem de turno inválida.'; end if;
  if p_kind in ('events','attachments') then
    select payload into parent from public.mop_records where workspace_id=p_workspace and id=(p_payload->>'item_id')::uuid;
    if not mop_private.mop_can_condo(p_workspace,parent->>'condo') then raise exception 'Registro fora do acesso.' using errcode='42501'; end if;
  end if;
  if p_kind='attachments' and (coalesce(p_payload->>'mime','') not in ('image/png','image/jpeg','application/pdf') or length(coalesce(p_payload->>'content',''))>699052 or length(coalesce(p_payload->>'content',''))=0) then raise exception 'Anexo inválido ou maior que 512 KB.'; end if;
  if p_kind='templates' and (coalesce(p_payload->>'title','')='' or coalesce(p_payload->>'key','')='' or coalesce(p_payload->>'frequency','') not in ('once','shift','daily','weekly','monthly') or jsonb_typeof(p_payload->'steps') is distinct from 'array') then raise exception 'Modelo inválido.'; end if;
  if p_kind='runs' and (coalesce(p_payload->>'template_key','')='' or coalesce(p_payload->>'slot','')='' or jsonb_typeof(p_payload->'answers') is distinct from 'array') then raise exception 'Execução inválida.'; end if;
  if p_kind='runs' then
    select payload into parent from public.mop_records where workspace_id=p_workspace and kind='templates' and payload->>'key'=p_payload->>'template_key';
    if parent is null or parent->>'condo' is distinct from p_payload->>'condo' then raise exception 'Modelo da execução indisponível.'; end if;
    if jsonb_array_length(p_payload->'answers')<>jsonb_array_length(parent->'steps') or exists(select 1 from jsonb_array_elements(p_payload->'answers') with ordinality a(value,n) where coalesce(a.value->>'value','') not in ('ok','fail','na') or a.value->>'label' is distinct from parent->'steps'->>((a.n-1)::integer)) then raise exception 'Checklist incompleto.'; end if;
  end if;
  if p_kind='receipts' and not exists(select 1 from public.mop_records where workspace_id=p_workspace and kind='items' and payload->>'protocol'=p_payload->>'protocol' and payload->>'condo'=p_payload->>'condo') then raise exception 'Registro da ciência indisponível.'; end if;
  select * into current_row from public.mop_records where workspace_id=p_workspace and id=p_id;
  if found and not mop_private.mop_can_record(p_workspace,current_row.kind,current_row.payload) then raise exception 'Registro fora do acesso.' using errcode='42501'; end if;
  if current_row.id is not null and p_kind in ('items','templates') and current_row.payload->>'condo' is distinct from p_payload->>'condo' then raise exception 'Condomínio não pode ser alterado.'; end if;
  if current_row.id is not null and current_row.kind<>p_kind then raise exception 'Tipo de registro incompatível.'; end if;
  if current_row.id is not null and current_row.payload=p_payload then
    result=jsonb_build_object('ok',true,'record',to_jsonb(current_row));
  elsif coalesce(current_row.version,0)<>p_base then
    return jsonb_build_object('ok',false,'record',to_jsonb(current_row));
  else
    if current_row.id is not null and p_kind not in ('items','templates') then raise exception 'Históricos e passagens sincronizados são imutáveis.'; end if;
    update public.mop_workspaces set revision=revision+1 where id=p_workspace returning revision into rev;
    insert into public.mop_records(workspace_id,id,kind,payload,version,revision,updated_by)
      values(p_workspace,p_id,p_kind,p_payload,coalesce(current_row.version,0)+1,rev,auth.uid())
      on conflict(workspace_id,id) do update set payload=excluded.payload,version=excluded.version,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
      returning * into current_row;
    result=jsonb_build_object('ok',true,'record',to_jsonb(current_row));
  end if;
  insert into public.mop_operations(workspace_id,op_id,record_id,kind,payload,result,user_id)
    values(p_workspace,p_op,p_id,p_kind,p_payload,result,auth.uid());
  return result;
end $$;
revoke all on function public.mop_push(uuid,uuid,uuid,text,bigint,jsonb) from public,anon;
grant execute on function public.mop_push(uuid,uuid,uuid,text,bigint,jsonb) to authenticated;

insert into public.mop_workspaces(id,name) values('00000000-0000-4000-8000-000000000001','Central operacional') on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mop_records'
  ) then alter publication supabase_realtime add table public.mop_records; end if;
end $$;
commit;

-- Após criar os dois operadores em Authentication > Users, execute separadamente:
-- insert into public.mop_members(workspace_id,user_id)
-- select '00000000-0000-4000-8000-000000000001',id from auth.users
-- where email in ('operador-1@example.invalid','operador-2@example.invalid')
-- on conflict do nothing;


-- Soft removal and admin-only guard, also maintained as a standalone migration.
-- Soft removal for operational records. Rows remain available to administrators
-- for audit and synchronization; hard deletion is not supported.
begin;

create or replace function mop_private.mop_guard_record_removal()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.kind <> 'items' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if nullif(new.payload->>'deleted_at','') is not null then
      if not mop_private.mop_is_admin(new.workspace_id)
        or length(trim(coalesce(new.payload->>'deleted_reason',''))) = 0
        or length(new.payload->>'deleted_reason') > 1000
        or nullif(new.payload->>'deleted_by','') is null then
        raise exception 'Remoção inicial inválida ou não autorizada.' using errcode='42501';
      end if;
    end if;
    return new;
  end if;

  if nullif(old.payload->>'deleted_at','') is not null then
    if old.payload is distinct from new.payload then
      raise exception 'Registros removidos não podem ser alterados.';
    end if;
    return new;
  end if;

  if nullif(new.payload->>'deleted_at','') is not null then
    if not mop_private.mop_is_admin(new.workspace_id) then
      raise exception 'Somente administradores podem remover registros.' using errcode='42501';
    end if;
    if length(trim(coalesce(new.payload->>'deleted_reason',''))) = 0
      or length(new.payload->>'deleted_reason') > 1000 then
      raise exception 'Informe o motivo da remoção.';
    end if;
    if nullif(new.payload->>'deleted_by','') is null then
      raise exception 'Autor da remoção ausente.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function mop_private.mop_guard_record_removal() from public, anon;
drop trigger if exists mop_guard_record_removal on public.mop_records;
create trigger mop_guard_record_removal
before insert or update of payload,kind on public.mop_records
for each row execute function mop_private.mop_guard_record_removal();

commit;


-- Operator identity privacy
begin;
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

create or replace function public.mop_push(p_workspace uuid,p_op uuid,p_id uuid,p_kind text,p_base bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.mop_records; old_op public.mop_operations; result jsonb; rev bigint; member public.mop_members; parent jsonb;
begin
  p_payload=mop_private.mop_private_payload(p_workspace,p_payload);
  if auth.uid() is null or not exists(select 1 from public.mop_members where workspace_id=p_workspace and user_id=auth.uid()) then
    raise exception 'Operador sem acesso a esta central.' using errcode='42501';
  end if;
  select * into member from public.mop_members where workspace_id=p_workspace and user_id=auth.uid();
  if member.role='viewer' or not mop_private.mop_can_record(p_workspace,p_kind,p_payload) then raise exception 'Alteração fora do seu acesso.' using errcode='42501'; end if;
  if p_kind='templates' and member.role not in ('supervisor','admin') then raise exception 'Somente supervisores podem configurar rotinas.' using errcode='42501'; end if;
  perform 1 from public.mop_workspaces where id=p_workspace for update;
  select * into old_op from public.mop_operations where workspace_id=p_workspace and op_id=p_op;
  if found then
    if old_op.record_id<>p_id or old_op.kind<>p_kind or mop_private.mop_private_payload(p_workspace,old_op.payload)<>p_payload then raise exception 'Operação reutilizada com conteúdo diferente.'; end if;
    return mop_private.mop_private_payload(p_workspace,old_op.result);
  end if;
  if p_id is null or p_op is null or p_kind is null or p_base is null or p_base<0 or p_payload is null
    or p_kind not in ('items','events','handovers','templates','runs','receipts','attachments') or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1048576 then
    raise exception 'Alteração inválida ou maior que 1 MB.';
  end if;
  if p_payload ? 'id' then raise exception 'Identificador local não deve ser enviado.'; end if;
  if p_kind='items' and (coalesce(p_payload->>'protocol','')!~'^MOP-[0-9]{8}-[A-Z0-9]{6,32}$'
      or coalesce(p_payload->>'status','') not in ('Pendente','Em andamento','Aguardando resposta','Aguardando manutenção','Resolvido')
      or coalesce(p_payload->>'subject','')='' or coalesce(p_payload->>'condo','')='') then raise exception 'Registro incompleto.'; end if;
  if p_kind in ('events','attachments') and not exists(select 1 from public.mop_records where workspace_id=p_workspace and id=(p_payload->>'item_id')::uuid and kind='items') then
    raise exception 'Registro do histórico ainda não sincronizado.';
  end if;
  if p_kind='handovers' and (jsonb_typeof(p_payload->'open_ids') is distinct from 'array'
      or (p_payload ? 'snapshot' and jsonb_typeof(p_payload->'snapshot')<>'array')) then raise exception 'Passagem de turno inválida.'; end if;
  if p_kind in ('events','attachments') then
    select payload into parent from public.mop_records where workspace_id=p_workspace and id=(p_payload->>'item_id')::uuid;
    if not mop_private.mop_can_condo(p_workspace,parent->>'condo') then raise exception 'Registro fora do acesso.' using errcode='42501'; end if;
  end if;
  if p_kind='attachments' and (coalesce(p_payload->>'mime','') not in ('image/png','image/jpeg','application/pdf') or length(coalesce(p_payload->>'content',''))>699052 or length(coalesce(p_payload->>'content',''))=0) then raise exception 'Anexo inválido ou maior que 512 KB.'; end if;
  if p_kind='templates' and (coalesce(p_payload->>'title','')='' or coalesce(p_payload->>'key','')='' or coalesce(p_payload->>'frequency','') not in ('once','shift','daily','weekly','monthly') or jsonb_typeof(p_payload->'steps') is distinct from 'array') then raise exception 'Modelo inválido.'; end if;
  if p_kind='runs' and (coalesce(p_payload->>'template_key','')='' or coalesce(p_payload->>'slot','')='' or jsonb_typeof(p_payload->'answers') is distinct from 'array') then raise exception 'Execução inválida.'; end if;
  if p_kind='runs' then
    select payload into parent from public.mop_records where workspace_id=p_workspace and kind='templates' and payload->>'key'=p_payload->>'template_key';
    if parent is null or parent->>'condo' is distinct from p_payload->>'condo' then raise exception 'Modelo da execução indisponível.'; end if;
    if jsonb_array_length(p_payload->'answers')<>jsonb_array_length(parent->'steps') or exists(select 1 from jsonb_array_elements(p_payload->'answers') with ordinality a(value,n) where coalesce(a.value->>'value','') not in ('ok','fail','na') or a.value->>'label' is distinct from parent->'steps'->>((a.n-1)::integer)) then raise exception 'Checklist incompleto.'; end if;
  end if;
  if p_kind='receipts' and not exists(select 1 from public.mop_records where workspace_id=p_workspace and kind='items' and payload->>'protocol'=p_payload->>'protocol' and payload->>'condo'=p_payload->>'condo') then raise exception 'Registro da ciência indisponível.'; end if;
  select * into current_row from public.mop_records where workspace_id=p_workspace and id=p_id;
  if found and not mop_private.mop_can_record(p_workspace,current_row.kind,current_row.payload) then raise exception 'Registro fora do acesso.' using errcode='42501'; end if;
  if current_row.id is not null and p_kind in ('items','templates') and current_row.payload->>'condo' is distinct from p_payload->>'condo' then raise exception 'Condomínio não pode ser alterado.'; end if;
  if current_row.id is not null and current_row.kind<>p_kind then raise exception 'Tipo de registro incompatível.'; end if;
  if current_row.id is not null and current_row.payload=p_payload then
    result=jsonb_build_object('ok',true,'record',to_jsonb(current_row));
  elsif coalesce(current_row.version,0)<>p_base then
    return jsonb_build_object('ok',false,'record',to_jsonb(current_row));
  else
    if current_row.id is not null and p_kind not in ('items','templates') then raise exception 'Históricos e passagens sincronizados são imutáveis.'; end if;
    update public.mop_workspaces set revision=revision+1 where id=p_workspace returning revision into rev;
    insert into public.mop_records(workspace_id,id,kind,payload,version,revision,updated_by)
      values(p_workspace,p_id,p_kind,p_payload,coalesce(current_row.version,0)+1,rev,auth.uid())
      on conflict(workspace_id,id) do update set payload=excluded.payload,version=excluded.version,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
      returning * into current_row;
    result=jsonb_build_object('ok',true,'record',to_jsonb(current_row));
  end if;
  insert into public.mop_operations(workspace_id,op_id,record_id,kind,payload,result,user_id)
    values(p_workspace,p_op,p_id,p_kind,p_payload,result,auth.uid());
  return result;
end $$;
revoke all on function public.mop_push(uuid,uuid,uuid,text,bigint,jsonb) from public,anon;
grant execute on function public.mop_push(uuid,uuid,uuid,text,bigint,jsonb) to authenticated;
commit;
