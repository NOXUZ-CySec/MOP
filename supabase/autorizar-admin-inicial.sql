-- Execute depois de supabase/mop.sql e de cadastrar o usuário em Authentication.
-- Substitua o e-mail pelo responsável que deve administrar esta instalação.
insert into public.mop_members(workspace_id,user_id,role,condos)
select '00000000-0000-4000-8000-000000000001',id,'admin',null
from auth.users
where lower(email)=lower('marcelosantostoledo1@gmail.com')
on conflict(workspace_id,user_id) do update
set role='admin',condos=null,access_version=public.mop_members.access_version+1;

do $$ begin
  if not exists (
    select 1 from public.mop_members m join auth.users u on u.id=m.user_id
    where m.workspace_id='00000000-0000-4000-8000-000000000001'
      and lower(u.email)=lower('marcelosantostoledo1@gmail.com')
      and m.role='admin' and m.condos is null
  ) then
    raise exception 'Conta não encontrada. Crie e confirme o e-mail em Authentication > Users e execute novamente.';
  end if;
end $$;
