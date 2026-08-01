begin;

alter table public.patients add column if not exists date_of_birth date;
alter table public.patients add column if not exists marital_status text;
alter table public.patients add column if not exists blood_group text;
alter table public.patients add column if not exists occupation text;
alter table public.patients add column if not exists religion text;
alter table public.patients add column if not exists preferred_language text;
alter table public.patients add column if not exists nationality text;
alter table public.patients add column if not exists aadhaar_number text;
alter table public.patients add column if not exists guardian_name text;
alter table public.patients add column if not exists guardian_relationship text;

update public.patients
set marital_status = case
  when lower(coalesce(gender,''))='male' then 'Not Applicable'
  when lower(coalesce(gender,''))='female' then 'Unmarried'
  else 'Not Applicable'
end
where marital_status is null or marital_status='';

update public.patients
set nationality='Indian'
where nationality is null or nationality='';

update public.patients
set preferred_language='Tamil'
where preferred_language is null or preferred_language='';

alter table public.patients drop constraint if exists patients_marital_status_check;
alter table public.patients add constraint patients_marital_status_check
check (marital_status in ('Unmarried','Married','Widowed','Divorced','Separated','Not Applicable'));

create unique index if not exists patients_aadhaar_unique_idx
on public.patients(aadhaar_number)
where aadhaar_number is not null and aadhaar_number<>'';

commit;

select 'SAMARA CARE ERP V3.5 PATIENT MASTER UPGRADE COMPLETED SUCCESSFULLY' as result;
