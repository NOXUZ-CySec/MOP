-- Preview94 HOMOLOGACAO: base compartilhada de escala.
-- Apenas tabelas e politicas de permissao; sem alterar registros existentes.
create table if not exists public.mop_schedule_days(
 workspace_id uuid not null references public.mop_workspaces(id),
 employee_id uuid not null references auth.users(id),
 work_date date not null,
 kind text not null check (kind in ('work','off','extra','swap','holiday-work','holiday-off')),
 reason text not null default '' check (length(reason)<=500),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,employee_id,work_date)
);
create index if not exists mop_schedule_days_by_date94 on public.mop_schedule_days(workspace_id,work_date);
alter table public.mop_schedule_days enable row level security;
revoke all on public.mop_schedule_days from public,anon,authenticated;
grant select,insert on public.mop_schedule_days to authenticated;
grant update(kind,reason,updated_by,updated_at) on public.mop_schedule_days to authenticated;
create policy mop94_days_read on public.mop_schedule_days for select to authenticated
using (
 exists(select 1 from public.mop_members self
   where self.workspace_id=mop_schedule_days.workspace_id and self.user_id=(select auth.uid())
   and (self.role in ('admin','supervisor') or mop_schedule_days.employee_id=(select auth.uid())))
);
create policy mop94_days_insert on public.mop_schedule_days for insert to authenticated
with check(
 updated_by=(select auth.uid()) and
 exists(select 1 from public.mop_members mgr where mgr.workspace_id=mop_schedule_days.workspace_id
    and mgr.user_id=(select auth.uid()) and mgr.role in ('admin','supervisor')) and
 exists(select 1 from public.mop_members target where target.workspace_id=mop_schedule_days.workspace_id
    and target.user_id=mop_schedule_days.employee_id and target.role in ('admin','supervisor','operator'))
);
create policy mop94_days_update on public.mop_schedule_days for update to authenticated
using(exists(select 1 from public.mop_members mgr where mgr.workspace_id=mop_schedule_days.workspace_id
    and mgr.user_id=(select auth.uid()) and mgr.role in ('admin','supervisor')))
with check(updated_by=(select auth.uid())
 and exists(select 1 from public.mop_members mgr where mgr.workspace_id=mop_schedule_days.workspace_id
    and mgr.user_id=(select auth.uid()) and mgr.role in ('admin','supervisor'))
 and exists(select 1 from public.mop_members target where target.workspace_id=mop_schedule_days.workspace_id
    and target.user_id=mop_schedule_days.employee_id and target.role in ('admin','supervisor','operator'))
);
do $$
begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
   and schemaname='public' and tablename='mop_schedule_days')
 then alter publication supabase_realtime add table public.mop_schedule_days;end if;
end $$;
