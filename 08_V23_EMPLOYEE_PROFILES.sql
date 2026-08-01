begin;

create table if not exists public.care_plans (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 status text not null default 'Active' check (status in ('Active','On Hold','Completed')),
 problems text,
 goals text,
 interventions text,
 evaluation text,
 created_by uuid references public.profiles(id),
 updated_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.risk_assessments (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 assessment_type text not null check (assessment_type in ('Morse Fall Scale','Braden Scale','Pain Assessment')),
 score numeric not null,
 risk_level text not null,
 details jsonb not null default '{}'::jsonb,
 remarks text,
 assessed_at timestamptz not null default now(),
 assessed_by uuid references public.profiles(id)
);

create table if not exists public.doctor_visit_notes (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 doctor_name text not null,
 clinical_findings text not null,
 advice text,
 visit_at timestamptz not null default now(),
 next_review_date date,
 recorded_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);

create table if not exists public.nutrition_assessments (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 appetite text,
 swallowing text,
 diet_type text,
 weight_loss_kg numeric default 0,
 recommendations text,
 assessed_at timestamptz not null default now(),
 assessed_by uuid references public.profiles(id)
);

alter table public.care_plans enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.doctor_visit_notes enable row level security;
alter table public.nutrition_assessments enable row level security;

drop policy if exists "Authenticated care plans" on public.care_plans;
create policy "Authenticated care plans" on public.care_plans for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated risk assessments" on public.risk_assessments;
create policy "Authenticated risk assessments" on public.risk_assessments for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated doctor notes" on public.doctor_visit_notes;
create policy "Authenticated doctor notes" on public.doctor_visit_notes for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated nutrition assessments" on public.nutrition_assessments;
create policy "Authenticated nutrition assessments" on public.nutrition_assessments for all to authenticated using (true) with check (true);

create index if not exists care_plans_patient_idx on public.care_plans(patient_id, updated_at desc);
create index if not exists risk_assessments_patient_idx on public.risk_assessments(patient_id, assessed_at desc);
create index if not exists doctor_visit_notes_patient_idx on public.doctor_visit_notes(patient_id, visit_at desc);
create index if not exists nutrition_assessments_patient_idx on public.nutrition_assessments(patient_id, assessed_at desc);

commit;

select 'SAMARA CARE ERP V3.2 CLINICAL INTELLIGENCE COMPLETED SUCCESSFULLY' as result;
