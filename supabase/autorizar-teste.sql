-- Execute após mop.sql. Autoriza somente o usuário de teste informado.
do $$
declare operator_id uuid;
begin
  select id into operator_id from auth.users where lower(email)='marcelosantostoledo1@gmail.com';
  if operator_id is null then raise exception 'Crie primeiro o usuário marcelosantostoledo1@gmail.com em Authentication > Users.'; end if;
  insert into public.mop_members(workspace_id,user_id)
  values('00000000-0000-4000-8000-000000000001',operator_id)
  on conflict do nothing;
end $$;
select u.email,m.workspace_id
from public.mop_members m join auth.users u on u.id=m.user_id
where lower(u.email)='marcelosantostoledo1@gmail.com';
