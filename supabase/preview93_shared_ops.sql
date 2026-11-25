-- Preview 93: additive shared checklists and shift swap requests.
-- Existing records, members, schedules and workspaces are not changed.
create table if not exists public.mop_checklist_tasks (
 workspace_id uuid not null references public.mop_workspaces(id) on delete cascade,
 id uuid not null default gen_random_uuid(),
 title text not null check (length(btrim(title)) between 1 and 120),
 period text not null check (period in ('Diurno','Noturno','Todos')),
 enabled boolean not null default true,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key (workspace_id,id)
);
create table if not exists public.mop_checklist_runs (
 workspace_id uuid not null,
 id uuid not null default gen_random_uuid(),
 task_id uuid not null,
 user_id uuid not null references auth.users(id),
 work_date date not null,
 completed_at timestamptz not null default now(),
 primary key (workspace_id,id),
 unique (workspace_id,task_id,user_id,work_date),
 foreign key (workspace_id,task_id) references public.mop_checklist_tasks(workspace_id,id)
);
create table if not exists public.mop_schedule_requests (
 workspace_id uuid not null references public.mop_workspaces(id) on delete cascade,
 id uuid not null default gen_random_uuid(),
 employee_id uuid not null references auth.users(id),
 work_date date not null,
 colleague text not null check (length(btrim(colleague)) between 1 and 100),
 reason text not null check (length(btrim(reason)) between 1 and 500),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 primary key (workspace_id,id),
 check ((status='pending' and decided_by is null and decided_at is null)
   or (status in ('approved','rejected') and decided_by is not null and decided_at is not null))
);
create index if not exists mop_checklist_runs_user_date93 on public.mop_checklist_runs(workspace_id,user_id,work_date);
create index if not exists mop_schedule_requests_status93 on public.mop_schedule_requests(workspace_id,status,created_at);
create index if not exists mop_schedule_requests_employee93 on public.mop_schedule_requests(workspace_id,employee_id,created_at);
alter table public.mop_checklist_tasks enable row level security;
alter table public.mop_checklist_runs enable row level security;
alter table public.mop_schedule_requests enable row level security;
revoke all on public.mop_checklist_tasks,public.mop_checklist_runs,public.mop_schedule_requests from public,anon,authenticated;
grant select,insert on public.mop_checklist_tasks to authenticated;
grant update(enabled) on public.mop_checklist_tasks to authenticated;
grant select,insert on public.mop_checklist_runs to authenticated;
grant select,insert on public.mop_schedule_requests to authenticated;
grant update(status,decided_by,decided_at) on public.mop_schedule_requests to authenticated;
create policy mop93_task_read on public.mop_checklist_tasks for select to authenticated
using (exists (select 1 from public.mop_members m where m.workspace_id=mop_checklist_tasks.workspace_id and m.user_id=(select auth.uid())));
create policy mop93_task_create on public.mop_checklist_tasks for insert to authenticated
with check (created_by=(select auth.uid()) and exists (select 1 from public.mop_members m where m.workspace_id=mop_checklist_tasks.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','supervisor')));
create policy mop93_task_update on public.mop_checklist_tasks for update to authenticated
using (exists (select 1 from public.mop_members m where m.workspace_id=mop_checklist_tasks.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','supervisor')))
with check (exists (select 1 from public.mop_members m where m.workspace_id=mop_checklist_tasks.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','supervisor')));
create policy mop93_run_read on public.mop_checklist_runs for select to authenticated
using (exists(select 1 from public.mop_members m where m.workspace_id=mop_checklist_runs.workspace_id and m.user_id=(select auth.uid()) and (m.role in ('admin','supervisor') or mop_checklist_runs.user_id=(select auth.uid()))));
create policy mop93_run_create on public.mop_checklist_runs for insert to authenticated
with check (user_id=(select auth.uid()) and work_date=(now() at time zone 'America/Sao_Paulo')::date
 and exists(select 1 from public.mop_members m where m.workspace_id=mop_checklist_runs.workspace_id and m.user_id=(select auth.uid()) and m.role<>'viewer')
 and exists(select 1 from public.mop_checklist_tasks t where t.workspace_id=mop_checklist_runs.workspace_id and t.id=mop_checklist_runs.task_id and t.enabled));
create policy mop93_request_read on public.mop_schedule_requests for select to authenticated
using (exists(select 1 from public.mop_members m where m.workspace_id=mop_schedule_requests.workspace_id and m.user_id=(select auth.uid()) and (m.role in ('admin','supervisor') or mop_schedule_requests.employee_id=(select auth.uid()))));
create policy mop93_request_create on public.mop_schedule_requests for insert to authenticated
with check (employee_id=(select auth.uid()) and status='pending' and decided_by is null and decided_at is null
 and exists(select 1 from public.mop_members m where m.workspace_id=mop_schedule_requests.workspace_id and m.user_id=(select auth.uid()) and m.role<>'viewer'));
create policy mop93_request_decide on public.mop_schedule_requests for update to authenticated
using (status='pending' and exists(select 1 from public.mop_members m where m.workspace_id=mop_schedule_requests.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','supervisor')))
with check (status in ('approved','rejected') and decided_by=(select auth.uid()) and decided_at is not null
 and exists(select 1 from public.mop_members m where m.workspace_id=mop_schedule_requests.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','supervisor')));
-- Row-level approval has a single atomic server transaction with schedule update.
create or replace function public.mop_validate_schedule_decision93()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.status <> 'pending' or new.status not in ('approved','rejected')
   or new.workspace_id is distinct from old.workspace_id or new.id is distinct from old.id
   or new.employee_id is distinct from old.employee_id or new.work_date is distinct from old.work_date
   or new.colleague is distinct from old.colleague or new.reason is distinct from old.reason
   or new.created_at is distinct from old.created_at
 then raise exception 'Invalid schedule decision transition'; end if;
 if new.status='approved' then
  insert into public.mop_schedule_days (workspace_id,employee_id,work_date,kind,reason,updated_by,updated_at)
  values(new.workspace_id,new.employee_id,new.work_date,'swap','Troca aprovada: '||new.colleague,new.decided_by,now())
  on conflict(workspace_id,employee_id,work_date)
  do update set kind=excluded.kind,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 end if;
 return new;
end $$;
revoke all on function public.mop_validate_schedule_decision93() from public,anon,authenticated;
create trigger mop_schedule_approve93 after update on public.mop_schedule_requests
for each row execute function public.mop_validate_schedule_decision93();
-- Availability signals on updated shared tables; RLS limits row visibility.
do $$
declare table_name text;
begin
 foreach table_name in array array['mop_checklist_tasks','mop_checklist_runs','mop_schedule_requests'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
   execute format('alter publication supabase_realtime add table public.%I',table_name);
  end if;
 end loop;
end $$;