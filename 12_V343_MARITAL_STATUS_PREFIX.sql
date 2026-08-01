begin;

create table if not exists public.clinical_notes (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 note_type text not null default 'General Observation',
 note_text text not null,
 observations text,
 recorded_at timestamptz not null default now(),
 recorded_by uuid references public.profiles(id)
);

create table if not exists public.shift_handovers (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 shift text not null check (shift in ('Morning','Afternoon','Night')),
 priority text not null default 'Routine' check (priority in ('Routine','High','Urgent')),
 summary text not null,
 pending_tasks text,
 recorded_at timestamptz not null default now(),
 recorded_by uuid references public.profiles(id)
);

create table if not exists public.medication_administration (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 medicine_name text not null,
 dose text,
 route text,
 scheduled_at timestamptz not null,
 administered_at timestamptz,
 status text not null default 'Pending' check (status in ('Given','Pending','Withheld','Missed','Refused')),
 remarks text,
 recorded_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);

create table if not exists public.care_specialist_notes (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id) on delete cascade,
 note_type text not null check (note_type in ('Doctor','Physiotherapy','Wound Care','Dietician','Other')),
 title text,
 notes text not null,
 follow_up text,
 recorded_at timestamptz not null default now(),
 recorded_by uuid references public.profiles(id)
);

alter table public.clinical_notes enable row level security;
alter table public.shift_handovers enable row level security;
alter table public.medication_administration enable row level security;
alter table public.care_specialist_notes enable row level security;

drop policy if exists "Authenticated clinical notes" on public.clinical_notes;
create policy "Authenticated clinical notes" on public.clinical_notes for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated shift handovers" on public.shift_handovers;
create policy "Authenticated shift handovers" on public.shift_handovers for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated MAR" on public.medication_administration;
create policy "Authenticated MAR" on public.medication_administration for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated specialist notes" on public.care_specialist_notes;
create policy "Authenticated specialist notes" on public.care_specialist_notes for all to authenticated using (true) with check (true);

create index if not exists clinical_notes_patient_at_idx on public.clinical_notes(patient_id, recorded_at desc);
create index if not exists handovers_patient_at_idx on public.shift_handovers(patient_id, recorded_at desc);
create index if not exists mar_patient_scheduled_idx on public.medication_administration(patient_id, scheduled_at desc);
create index if not exists specialist_notes_patient_at_idx on public.care_specialist_notes(patient_id, recorded_at desc);

commit;

select 'SAMARA CARE ERP V3.1 CARE MODULES COMPLETED SUCCESSFULLY' as result;
