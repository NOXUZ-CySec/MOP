-- Preview 100: checklist conclusion belongs to the operational team/workspace.
-- Existing individual completions remain untouched in mop_checklist_runs.
create table if not exists public.mop_checklist_team_runs (
  workspace_id uuid not null,
  task_id uuid not null,
  work_date date not null,
  completed_by uuid not null references auth.users(id),
  completed_at timestamptz not null default now(),
  primary key(workspace_id,task_id,work_date),
  foreign key(workspace_id,task_id) references public.mop_checklist_tasks(workspace_id,id)
);
alter table public.mop_checklist_team_runs enable row level security;
drop policy if exists mop100_team_runs_read on public.mop_checklist_team_runs;
create policy mop100_team_runs_read on public.mop_checklist_team_runs for select to authenticated
 using(exists(select 1 from public.mop_members m where m.workspace_id=mop_checklist_team_runs.workspace_id and m.user_id=(select auth.uid())));
drop policy if exists mop100_team_runs_create on public.mop_checklist_team_runs;
create policy mop100_team_runs_create on public.mop_checklist_team_runs for insert to authenticated
 with check(completed_by=(select auth.uid()) and work_date=(now() at time zone 'America/Sao_Paulo')::date
  and exists(select 1 from public.mop_members m where m.workspace_id=mop_checklist_team_runs.workspace_id and m.user_id=(select auth.uid()) and m.role<>'viewer')
  and exists(select 1 from public.mop_checklist_tasks t where t.workspace_id=mop_checklist_team_runs.workspace_id and t.id=mop_checklist_team_runs.task_id and t.enabled=true));
grant select,insert on public.mop_checklist_team_runs to authenticated;
revoke all on public.mop_checklist_team_runs from anon;
insert into public.mop_checklist_team_runs(workspace_id,task_id,work_date,completed_by,completed_at)
 select distinct on (workspace_id,task_id,work_date)
 workspace_id,task_id,work_date,user_id,completed_at
 from public.mop_checklist_runs order by workspace_id,task_id,work_date,completed_at
 on conflict do nothing;
