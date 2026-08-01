begin;

alter table public.profiles add column if not exists designation text;
alter table public.profiles add column if not exists emergency_contact text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists date_of_joining date;
alter table public.profiles add column if not exists qualification text;

create table if not exists public.employee_documents (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.profiles(id) on delete cascade,
 category text not null,
 title text not null,
 document_date date,
 storage_path text not null,
 file_name text,
 mime_type text,
 file_size bigint,
 remarks text,
 uploaded_by uuid references public.profiles(id),
 uploaded_at timestamptz not null default now()
);
create index if not exists employee_documents_employee_idx on public.employee_documents(employee_id, uploaded_at desc);
alter table public.employee_documents enable row level security;

do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='employee_documents' loop
  execute format('drop policy if exists %I on public.employee_documents',p.policyname);
 end loop;
end $$;

create policy "Admin read employee documents" on public.employee_documents for select to authenticated using(public.samara_is_admin());
create policy "Admin insert employee documents" on public.employee_documents for insert to authenticated with check(public.samara_is_admin() and uploaded_by=auth.uid());
create policy "Admin update employee documents" on public.employee_documents for update to authenticated using(public.samara_is_admin()) with check(public.samara_is_admin());
create policy "Admin delete employee documents" on public.employee_documents for delete to authenticated using(public.samara_is_admin());

-- Employee files are stored in the existing private patient-documents bucket under employees/<employee-id>/...
drop policy if exists "Admin employee storage read" on storage.objects;
drop policy if exists "Admin employee storage insert" on storage.objects;
drop policy if exists "Admin employee storage update" on storage.objects;
drop policy if exists "Admin employee storage delete" on storage.objects;
create policy "Admin employee storage read" on storage.objects for select to authenticated using(bucket_id='patient-documents' and name like 'employees/%' and public.samara_is_admin());
create policy "Admin employee storage insert" on storage.objects for insert to authenticated with check(bucket_id='patient-documents' and name like 'employees/%' and public.samara_is_admin());
create policy "Admin employee storage update" on storage.objects for update to authenticated using(bucket_id='patient-documents' and name like 'employees/%' and public.samara_is_admin()) with check(bucket_id='patient-documents' and name like 'employees/%' and public.samara_is_admin());
create policy "Admin employee storage delete" on storage.objects for delete to authenticated using(bucket_id='patient-documents' and name like 'employees/%' and public.samara_is_admin());

commit;
select 'SAMARA CARE V2.3 EMPLOYEE PROFILES COMPLETED SUCCESSFULLY' as result;
