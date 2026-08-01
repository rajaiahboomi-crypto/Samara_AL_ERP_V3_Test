begin;

alter table public.patients
  add column if not exists marital_status text;

update public.patients
set marital_status = case
  when lower(coalesce(gender,''))='male' then 'Not Applicable'
  when lower(coalesce(gender,''))='female' then 'Unmarried'
  else 'Not Applicable'
end
where marital_status is null or marital_status='';

alter table public.patients
  drop constraint if exists patients_marital_status_check;

alter table public.patients
  add constraint patients_marital_status_check
  check (marital_status in ('Unmarried','Married','Widowed','Divorced','Separated','Not Applicable'));

commit;

select 'SAMARA CARE ERP V3.4.3 MARITAL STATUS AND RESPECTFUL PREFIX COMPLETED SUCCESSFULLY' as result;
