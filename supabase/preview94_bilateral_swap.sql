-- Preview 94: mutual confirmation before supervisory shift exchange.
-- Additive schema change; no historical request or schedule rows removed.
create or replace function mop_private93.is_workspace_member94(p_workspace uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.mop_members m
  where m.workspace_id=p_workspace
    and m.user_id=(select auth.uid())
    and m.role in ('operator','supervisor','admin')
 );
$$;
revoke all on function mop_private93.is_workspace_member94(uuid) from public,anon,authenticated;
grant execute on function mop_private93.is_workspace_member94(uuid) to authenticated;

create policy mop94_team_directory on public.mop_members
for select to authenticated
using (mop_private93.is_workspace_member94(workspace_id));

alter table public.mop_schedule_requests
 add column if not exists colleague_id uuid references auth.users(id),
 add column if not exists colleague_work_date date,
 add column if not exists colleague_response text not null default 'pending',
 add column if not exists colleague_responded_at timestamptz;
alter table public.mop_schedule_requests
 add constraint mop94_colleague_response_check
 check(colleague_response in ('pending','accepted','declined'));
alter table public.mop_schedule_requests drop constraint mop_schedule_requests_check;
alter table public.mop_schedule_requests
 add constraint mop94_request_state_check check (
   (status='pending' and decided_by is null and decided_at is null and colleague_response in ('pending','accepted'))
   or (status='approved' and colleague_response='accepted' and decided_by is not null and decided_at is not null)
   or (status='rejected' and (
      (colleague_response='declined' and decided_by is null and decided_at is null)
      or (decided_by is not null and decided_at is not null)
   ))
 );
create index if not exists mop94_peer_queue on public.mop_schedule_requests(workspace_id,colleague_id,status,created_at);
create index if not exists mop94_initiator_queue on public.mop_schedule_requests(workspace_id,employee_id,created_at);
grant update(colleague_response) on public.mop_schedule_requests to authenticated;
drop policy if exists mop93_request_create on public.mop_schedule_requests;
drop policy if exists mop93_request_decide on public.mop_schedule_requests;
create policy mop94_request_create on public.mop_schedule_requests for insert to authenticated
with check (
 employee_id=(select auth.uid())
 and colleague_id is not null and colleague_id<>employee_id
 and colleague_work_date is not null and colleague_work_date<>work_date
 and status='pending' and colleague_response='pending'
 and colleague_responded_at is null and decided_by is null and decided_at is null
 and exists(select 1 from public.mop_members m where m.workspace_id=mop_schedule_requests.workspace_id and m.user_id=(select auth.uid()) and m.role in ('operator','supervisor','admin'))
 and exists(select 1 from public.mop_members p where p.workspace_id=mop_schedule_requests.workspace_id and p.user_id=mop_schedule_requests.colleague_id and p.role in ('operator','supervisor','admin'))
);
create policy mop94_peer_read on public.mop_schedule_requests for select to authenticated
using(colleague_id=(select auth.uid()) and mop_private93.is_workspace_member94(workspace_id));
create policy mop94_peer_respond on public.mop_schedule_requests for update to authenticated
using (status='pending' and colleague_response='pending' and colleague_id=(select auth.uid()) and mop_private93.is_workspace_member94(workspace_id))
with check (colleague_id=(select auth.uid()) and (
 (status='pending' and colleague_response='accepted') or
 (status='rejected' and colleague_response='declined')
));
create policy mop94_manager_decide on public.mop_schedule_requests for update to authenticated
using (status='pending' and exists (select 1 from public.mop_members m
 where m.workspace_id=mop_schedule_requests.workspace_id and m.user_id=(select auth.uid())
 and m.role in ('supervisor','admin')) and (select auth.uid()) not in (employee_id,colleague_id))
with check (
 decided_by=(select auth.uid()) and decided_at is not null
 and (status='rejected' or (status='approved' and colleague_response='accepted'))
 and exists (select 1 from public.mop_members m
 where m.workspace_id=mop_schedule_requests.workspace_id and m.user_id=(select auth.uid())
 and m.role in ('supervisor','admin'))
 and (select auth.uid()) not in (employee_id,colleague_id)
);

drop trigger if exists mop_schedule_approve93 on public.mop_schedule_requests;
create or replace function public.mop_schedule_transition94()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare
 actor uuid:=(select auth.uid());
 is_manager boolean:=false;
 peer_name text;
begin
 if TG_OP='INSERT' then
   if new.employee_id is distinct from actor or new.colleague_id is null
      or new.colleague_id=new.employee_id
      or new.colleague_work_date is null or new.colleague_work_date=new.work_date
      or new.status<>'pending' or new.colleague_response<>'pending'
      or new.colleague_responded_at is not null or new.decided_at is not null or new.decided_by is not null
   then raise exception 'Identidade ou estado da solicitação inválido'; end if;
   select coalesce(nullif(btrim(m.display_name),''),nullif(m.username,''),'Colaborador') into peer_name
   from public.mop_members m where m.workspace_id=new.workspace_id and m.user_id=new.colleague_id
     and m.role in ('operator','supervisor','admin');
   if peer_name is null then raise exception 'Colaborador não pertence à central'; end if;
   new.colleague:=left(peer_name,100);
   return new;
 end if;
 if new.workspace_id is distinct from old.workspace_id
    or new.id is distinct from old.id
    or new.employee_id is distinct from old.employee_id
    or new.work_date is distinct from old.work_date
    or new.colleague is distinct from old.colleague
    or new.colleague_id is distinct from old.colleague_id
    or new.colleague_work_date is distinct from old.colleague_work_date
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
 then raise exception 'Os dados de uma troca não podem ser alterados'; end if;
 if old.status<>'pending' then raise exception 'Troca já encerrada'; end if;
 if actor=old.colleague_id and old.colleague_response='pending'
    and new.colleague_response in ('accepted','declined')
    and new.colleague_response<>old.colleague_response
    and new.status=old.status and new.decided_by is not distinct from old.decided_by
    and new.decided_at is not distinct from old.decided_at
    and new.colleague_responded_at is not distinct from old.colleague_responded_at
 then
   new.colleague_responded_at:=now();
   if new.colleague_response='declined' then new.status:='rejected'; end if;
   return new;
 end if;
 select exists(select 1 from public.mop_members m where m.workspace_id=old.workspace_id
 and m.user_id=actor and m.role in ('admin','supervisor')) into is_manager;
 if is_manager and actor is distinct from old.employee_id and actor is distinct from old.colleague_id
    and new.colleague_response=old.colleague_response
    and new.colleague_responded_at is not distinct from old.colleague_responded_at
    and new.status in ('approved','rejected') and new.status<>old.status
    and new.decided_by=actor and new.decided_at is not null
    and (new.status<>'approved' or old.colleague_response='accepted')
 then
   new.decided_at:=now();
   return new;
 end if;
 raise exception 'A troca exige aceite do colega e decisão independente do gestor';
end $$;
revoke all on function public.mop_schedule_transition94() from public,anon,authenticated;
create trigger mop94_request_transition
before insert or update on public.mop_schedule_requests
for each row execute function public.mop_schedule_transition94();

create or replace function public.mop_schedule_apply94()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare
 current_row record;
 requester_from text;
 requester_to text;
 colleague_from text;
 colleague_to text;
 seen int:=0;
begin
 if old.status='pending' and new.status='approved' then
   -- Lock all four assignments in a stable order, aborting on incomplete/changed schedules.
   for current_row in
      select employee_id,work_date,kind from public.mop_schedule_days
      where workspace_id=new.workspace_id and
       ((employee_id=new.employee_id and work_date in (new.work_date,new.colleague_work_date))
        or (employee_id=new.colleague_id and work_date in (new.work_date,new.colleague_work_date)))
      order by employee_id,work_date for update
   loop
     seen:=seen+1;
     if current_row.employee_id=new.employee_id and current_row.work_date=new.work_date then requester_from:=current_row.kind; end if;
     if current_row.employee_id=new.employee_id and current_row.work_date=new.colleague_work_date then requester_to:=current_row.kind; end if;
     if current_row.employee_id=new.colleague_id and current_row.work_date=new.work_date then colleague_from:=current_row.kind; end if;
     if current_row.employee_id=new.colleague_id and current_row.work_date=new.colleague_work_date then colleague_to:=current_row.kind; end if;
   end loop;
   if seen<>4 or requester_from<>'work' or requester_to<>'off'
      or colleague_from<>'off' or colleague_to<>'work'
   then
      raise exception 'Troca não aplicável: cadastre e confirme as quatro classificações na escala central (trabalho/folga de ambos os colaboradores)';
   end if;
   update public.mop_schedule_days set
     kind=case
       when employee_id=new.employee_id and work_date=new.work_date then 'off'
       when employee_id=new.employee_id and work_date=new.colleague_work_date then 'swap'
       when employee_id=new.colleague_id and work_date=new.work_date then 'swap'
       when employee_id=new.colleague_id and work_date=new.colleague_work_date then 'off'
     end,
     reason='Troca aprovada ('||new.id::text||')',
     updated_by=new.decided_by,updated_at=now()
   where workspace_id=new.workspace_id
     and employee_id in(new.employee_id,new.colleague_id)
     and work_date in(new.work_date,new.colleague_work_date);
 end if;
 return new;
end $$;
revoke all on function public.mop_schedule_apply94() from public,anon,authenticated;
create trigger mop94_apply_swap after update on public.mop_schedule_requests
for each row execute function public.mop_schedule_apply94();