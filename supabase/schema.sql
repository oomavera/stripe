create extension if not exists pgcrypto;

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(phone) between 7 and 24),
  created_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;
alter table public.subscribers force row level security;

revoke all on table public.subscribers from anon, authenticated;
grant all on table public.subscribers to service_role;

comment on table public.subscribers is
  'Private Sunday Sessions update list. Accessible only through owner-authorized server functions.';
