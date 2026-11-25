-- Preview 93 supplemental migration: managers may read their own workspace membership.
-- Fixes existing schedule RLS target membership check without exposing other workspaces.
create schema if not exists mop_private93;
revoke all on schema mop_private93 from public, anon;
grant usage on schema mop_private93 to authenticated;
create or replace function mop_private93.is_workspace_manager(p_workspace uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
   select 1 from public.mop_members m
   where m.workspace_id=p_workspace
     and m.user_id=(select auth.uid())
     and m.role in ('admin','supervisor')
 );
$$;
revoke all on function mop_private93.is_workspace_manager(uuid) from public,anon,authenticated;
grant execute on function mop_private93.is_workspace_manager(uuid) to authenticated;
create policy mop93_manager_read_own_workspace_members
on public.mop_members for select to authenticated
using ((select mop_private93.is_workspace_manager(mop_members.workspace_id)));