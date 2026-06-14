alter table public.orders
add column if not exists subtotal_amount numeric not null default 0,
add column if not exists discount_amount numeric not null default 0,
add column if not exists discount_reason text,
add column if not exists discount_applied_at timestamp with time zone;

update public.orders
set
  subtotal_amount = coalesce(total_amount, 0),
  discount_amount = coalesce(discount_amount, 0)
where subtotal_amount = 0;
