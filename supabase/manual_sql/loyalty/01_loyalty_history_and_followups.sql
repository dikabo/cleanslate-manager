-- Loyalty / historique client / relances
-- A executer manuellement dans Supabase SQL Editor.
-- Ce script ne transforme pas l'historique Excel en commandes operationnelles.
-- Il cree une couche separee qui alimente les statistiques fidelite.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  source_kind text not null default 'legacy_excel',
  imported_by uuid references auth.users(id),
  imported_at timestamptz not null default now(),
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  phone text not null,
  label text,
  is_primary boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  unique (client_id, phone)
);

create table if not exists public.client_name_aliases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text,
  confidence numeric not null default 0.8,
  created_at timestamptz not null default now(),
  unique (client_id, normalized_alias)
);

create table if not exists public.legacy_client_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  transaction_date date,
  amount numeric not null default 0,
  payment_status text not null default 'unknown'
    check (payment_status in ('paid', 'unpaid', 'unknown')),
  delivery_status text not null default 'unknown'
    check (delivery_status in ('delivered', 'not_delivered', 'unknown')),
  raw_name text,
  normalized_name text,
  raw_contact text,
  normalized_phones text[] not null default '{}'::text[],
  raw_observation text,
  source_file_name text,
  source_sheet text not null,
  source_row integer not null,
  quality_flags text[] not null default '{}'::text[],
  notes text,
  created_at timestamptz not null default now(),
  unique (source_sheet, source_row, import_batch_id)
);

create table if not exists public.client_follow_ups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  due_date date not null,
  reason text not null,
  status text not null default 'planned'
    check (status in ('planned', 'done', 'postponed', 'cancelled')),
  contact_channel text not null default 'phone'
    check (contact_channel in ('phone', 'whatsapp', 'email', 'in_person', 'other')),
  assigned_to uuid references auth.users(id),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  result text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_contacts_phone
  on public.client_contacts (phone);

create index if not exists idx_client_name_aliases_normalized
  on public.client_name_aliases (normalized_alias);

create index if not exists idx_legacy_client_transactions_client
  on public.legacy_client_transactions (client_id);

create index if not exists idx_legacy_client_transactions_date
  on public.legacy_client_transactions (transaction_date);

create index if not exists idx_legacy_client_transactions_phones
  on public.legacy_client_transactions using gin (normalized_phones);

create index if not exists idx_client_follow_ups_due_status
  on public.client_follow_ups (status, due_date);

create or replace view public.client_loyalty_summary as
with live_orders as (
  select
    client_id,
    count(*)::integer as live_orders_count,
    coalesce(sum(total_amount), 0)::numeric as live_revenue,
    max(created_at)::date as last_live_order_date
  from public.orders
  where client_id is not null
  group by client_id
),
legacy_orders as (
  select
    client_id,
    count(*)::integer as legacy_orders_count,
    coalesce(sum(amount), 0)::numeric as legacy_revenue,
    max(transaction_date) as last_legacy_order_date
  from public.legacy_client_transactions
  where client_id is not null
    and amount > 0
  group by client_id
),
followups as (
  select
    client_id,
    min(due_date) filter (where status = 'planned') as next_follow_up_at,
    count(*) filter (where status = 'planned' and due_date < current_date)::integer as overdue_follow_ups
  from public.client_follow_ups
  group by client_id
)
select
  c.id as client_id,
  c.name,
  c.phone,
  c.email,
  c.created_at,
  coalesce(lo.live_orders_count, 0) as live_orders_count,
  coalesce(lo.live_revenue, 0) as live_revenue,
  lo.last_live_order_date,
  coalesce(leg.legacy_orders_count, 0) as legacy_orders_count,
  coalesce(leg.legacy_revenue, 0) as legacy_revenue,
  leg.last_legacy_order_date,
  coalesce(lo.live_orders_count, 0) + coalesce(leg.legacy_orders_count, 0) as total_known_orders,
  coalesce(lo.live_revenue, 0) + coalesce(leg.legacy_revenue, 0) as total_known_revenue,
  greatest(
    coalesce(lo.last_live_order_date, date '1900-01-01'),
    coalesce(leg.last_legacy_order_date, date '1900-01-01')
  ) as last_activity_date,
  case
    when greatest(coalesce(lo.last_live_order_date, date '1900-01-01'), coalesce(leg.last_legacy_order_date, date '1900-01-01')) = date '1900-01-01'
      then null
    else current_date - greatest(coalesce(lo.last_live_order_date, date '1900-01-01'), coalesce(leg.last_legacy_order_date, date '1900-01-01'))
  end as days_since_last_activity,
  case
    when coalesce(lo.live_revenue, 0) + coalesce(leg.legacy_revenue, 0) >= 150000
      or coalesce(lo.live_orders_count, 0) + coalesce(leg.legacy_orders_count, 0) >= 6
      then 'vip'
    when coalesce(lo.live_orders_count, 0) + coalesce(leg.legacy_orders_count, 0) >= 3
      then 'regular'
    when coalesce(lo.live_orders_count, 0) + coalesce(leg.legacy_orders_count, 0) = 1
      then 'new_or_once'
    else 'unknown'
  end as loyalty_tier,
  case
    when current_date - greatest(coalesce(lo.last_live_order_date, date '1900-01-01'), coalesce(leg.last_legacy_order_date, date '1900-01-01')) >= 180
      and (coalesce(lo.live_revenue, 0) + coalesce(leg.legacy_revenue, 0) >= 75000
        or coalesce(lo.live_orders_count, 0) + coalesce(leg.legacy_orders_count, 0) >= 3)
      then 'dormant_high_value'
    when current_date - greatest(coalesce(lo.last_live_order_date, date '1900-01-01'), coalesce(leg.last_legacy_order_date, date '1900-01-01')) >= 90
      then 'to_reactivate'
    when coalesce(f.overdue_follow_ups, 0) > 0
      then 'follow_up_overdue'
    else 'active'
  end as loyalty_segment,
  f.next_follow_up_at,
  coalesce(f.overdue_follow_ups, 0) as overdue_follow_ups
from public.clients c
left join live_orders lo on lo.client_id = c.id
left join legacy_orders leg on leg.client_id = c.id
left join followups f on f.client_id = c.id;

alter table public.import_batches enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_name_aliases enable row level security;
alter table public.legacy_client_transactions enable row level security;
alter table public.client_follow_ups enable row level security;

drop policy if exists "Admins and Receptionists can manage import batches" on public.import_batches;
create policy "Admins and Receptionists can manage import batches"
  on public.import_batches for all to authenticated
  using (has_admin_or_receptionist_role())
  with check (has_admin_or_receptionist_role());

drop policy if exists "Admins and Receptionists can manage client contacts" on public.client_contacts;
create policy "Admins and Receptionists can manage client contacts"
  on public.client_contacts for all to authenticated
  using (has_admin_or_receptionist_role())
  with check (has_admin_or_receptionist_role());

drop policy if exists "Admins and Receptionists can manage client aliases" on public.client_name_aliases;
create policy "Admins and Receptionists can manage client aliases"
  on public.client_name_aliases for all to authenticated
  using (has_admin_or_receptionist_role())
  with check (has_admin_or_receptionist_role());

drop policy if exists "Admins and Receptionists can manage legacy transactions" on public.legacy_client_transactions;
create policy "Admins and Receptionists can manage legacy transactions"
  on public.legacy_client_transactions for all to authenticated
  using (has_admin_or_receptionist_role())
  with check (has_admin_or_receptionist_role());

drop policy if exists "Admins and Receptionists can manage follow ups" on public.client_follow_ups;
create policy "Admins and Receptionists can manage follow ups"
  on public.client_follow_ups for all to authenticated
  using (has_admin_or_receptionist_role())
  with check (has_admin_or_receptionist_role());

create or replace function public.set_client_follow_ups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_follow_ups_updated_at on public.client_follow_ups;
create trigger trg_client_follow_ups_updated_at
  before update on public.client_follow_ups
  for each row execute function public.set_client_follow_ups_updated_at();
