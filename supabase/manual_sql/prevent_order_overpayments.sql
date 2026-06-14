-- Prevent collected payments from exceeding the order total.
-- Apply this manually in Supabase SQL editor.
--
-- What this script does:
-- 1) Blocks any new/edited payment that would make paid_amount > total_amount.
-- 2) Blocks refunds that would make the collected amount negative.
-- 3) Keeps orders.paid_amount and orders.is_paid synchronized from public.payments.
--
-- Existing overpaid orders must be cleaned before relying on this guard for them.

create or replace function public.recalculate_order_payment_status(target_order_id uuid)
returns void
language plpgsql
as $$
declare
  synced_paid_amount numeric;
begin
  if target_order_id is null then
    return;
  end if;

  select greatest(
    0,
    coalesce(
      sum(
        case
          when payment_type::text = 'refund' then -amount
          else amount
        end
      ),
      0
    )
  )
  into synced_paid_amount
  from public.payments
  where order_id = target_order_id;

  update public.orders
  set
    paid_amount = synced_paid_amount,
    is_paid = synced_paid_amount >= coalesce(total_amount, 0)
  where id = target_order_id;
end;
$$;

create or replace function public.validate_payment_not_over_order_total()
returns trigger
language plpgsql
as $$
declare
  order_total numeric;
  current_paid numeric;
  incoming_signed_amount numeric;
  proposed_paid numeric;
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Le montant du paiement doit etre superieur a 0.';
  end if;

  select coalesce(total_amount, 0)
  into order_total
  from public.orders
  where id = new.order_id
  for update;

  if not found then
    raise exception 'Commande introuvable pour ce paiement.';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(
      sum(
        case
          when payment_type::text = 'refund' then -amount
          else amount
        end
      ),
      0
    )
    into current_paid
    from public.payments
    where order_id = new.order_id;
  else
    select coalesce(
      sum(
        case
          when payment_type::text = 'refund' then -amount
          else amount
        end
      ),
      0
    )
    into current_paid
    from public.payments
    where order_id = new.order_id
      and id <> old.id;
  end if;

  incoming_signed_amount := case
    when new.payment_type::text = 'refund' then -new.amount
    else new.amount
  end;

  proposed_paid := current_paid + incoming_signed_amount;

  if proposed_paid > order_total then
    raise exception 'Encaissement impossible: le total encaisse (%) depasse le total de la commande (%).',
      proposed_paid, order_total;
  end if;

  if proposed_paid < 0 then
    raise exception 'Remboursement impossible: le total encaisse ne peut pas devenir negatif.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_payment_not_over_order_total on public.payments;

create trigger trg_validate_payment_not_over_order_total
before insert or update of amount, payment_type, order_id
on public.payments
for each row
execute function public.validate_payment_not_over_order_total();

create or replace function public.sync_order_paid_amount_from_payments()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_order_payment_status(new.order_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.recalculate_order_payment_status(new.order_id);

    if old.order_id is distinct from new.order_id then
      perform public.recalculate_order_payment_status(old.order_id);
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.recalculate_order_payment_status(old.order_id);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_order_paid_amount_from_payments on public.payments;

create trigger trg_sync_order_paid_amount_from_payments
after insert or update or delete
on public.payments
for each row
execute function public.sync_order_paid_amount_from_payments();

-- Optional verification query to find remaining overpaid orders.
-- Run it after cleaning known duplicates.
--
-- select
--   o.id,
--   o.ticket_number,
--   c.name as client_name,
--   o.total_amount,
--   o.paid_amount,
--   o.paid_amount - o.total_amount as surplus
-- from public.orders o
-- left join public.clients c on c.id = o.client_id
-- where o.paid_amount > o.total_amount
-- order by surplus desc;
