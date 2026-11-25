-- Applied to MOP-Homologacao: add explicit absence and medical day classifications.
-- Existing schedule records remain unchanged.
alter table public.mop_schedule_days drop constraint if exists mop_schedule_days_kind_check;
alter table public.mop_schedule_days add constraint mop_schedule_days_kind_check
check (kind in ('work','off','extra','swap','holiday-work','holiday-off','absence','medical'));
