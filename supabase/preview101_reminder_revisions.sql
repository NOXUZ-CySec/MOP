-- Preview 101: preserve multiple same-day completions when a routine is rescheduled to a later hour.
alter table public.mop_checklist_tasks add column if not exists reminder_revision integer not null default 0;
alter table public.mop_checklist_team_runs add column if not exists reminder_revision integer not null default 0;
alter table public.mop_checklist_team_runs drop constraint if exists mop_checklist_team_runs_pkey;
alter table public.mop_checklist_team_runs add constraint mop_checklist_team_runs_pkey primary key (workspace_id,task_id,work_date,reminder_revision);
grant update (reminder_revision) on public.mop_checklist_tasks to authenticated;
