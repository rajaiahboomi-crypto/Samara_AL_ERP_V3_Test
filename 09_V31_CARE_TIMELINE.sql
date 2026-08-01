begin;

create table if not exists public.message_templates (
 id uuid primary key default gen_random_uuid(),
 event_type text not null unique,
 template_name text not null,
 template_body text not null,
 active boolean not null default true,
 updated_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.notification_rules (
 id uuid primary key default gen_random_uuid(),
 event_type text not null unique,
 whatsapp_enabled boolean not null default true,
 sms_enabled boolean not null default false,
 email_enabled boolean not null default false,
 in_app_enabled boolean not null default true,
 approval_mode text not null default 'Manual' check (approval_mode in ('Manual','Administrator')),
 updated_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;
alter table public.notification_rules enable row level security;

drop policy if exists "Authenticated message templates read" on public.message_templates;
create policy "Authenticated message templates read" on public.message_templates for select to authenticated using (true);
drop policy if exists "Admin manager templates write" on public.message_templates;
create policy "Admin manager templates write" on public.message_templates for all to authenticated using (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('Admin','Manager'))
) with check (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('Admin','Manager'))
);

drop policy if exists "Authenticated notification rules read" on public.notification_rules;
create policy "Authenticated notification rules read" on public.notification_rules for select to authenticated using (true);
drop policy if exists "Admin manager rules write" on public.notification_rules;
create policy "Admin manager rules write" on public.notification_rules for all to authenticated using (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('Admin','Manager'))
) with check (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('Admin','Manager'))
);

commit;

select 'SAMARA CARE ERP V3.4 COMMUNICATION CENTRE COMPLETED SUCCESSFULLY' as result;
