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
