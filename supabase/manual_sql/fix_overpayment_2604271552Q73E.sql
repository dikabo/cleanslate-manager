-- Correction manuelle du trop-percu sur la commande 2604271552Q73E / client essono.
-- A executer dans Supabase SQL Editor.
--
-- Important:
-- 1) Lance d'abord la requete de verification.
-- 2) Si le paiement en trop est une ligne entierement en surplus, utilise la suppression par id.
-- 3) Si le paiement en trop contient une partie normale + le surplus, utilise plutot la correction du montant.

-- Verification: commande, client, total, encaisse, surplus.
select
  o.id as order_id,
  o.ticket_number,
  c.name as client_name,
  o.total_amount,
  o.paid_amount,
  greatest(o.paid_amount - o.total_amount, 0) as surplus
from public.orders o
join public.clients c on c.id = o.client_id
where o.ticket_number = '2604271552Q73E'
  and c.name ilike '%essono%';

-- Verification: historique des paiements et cumul progressif.
with target_order as (
  select o.id, o.total_amount
  from public.orders o
  join public.clients c on c.id = o.client_id
  where o.ticket_number = '2604271552Q73E'
    and c.name ilike '%essono%'
),
payment_history as (
  select
    p.id,
    p.order_id,
    p.created_at,
    p.amount,
    p.payment_type,
    p.payment_method,
    p.reference,
    p.notes,
    t.total_amount,
    sum(
      case
        when p.payment_type::text = 'refund' then -p.amount
        else p.amount
      end
    ) over (
      partition by p.order_id
      order by p.created_at, p.id
      rows between unbounded preceding and current row
    ) as paid_after_payment
  from public.payments p
  join target_order t on t.id = p.order_id
)
select
  *,
  greatest(paid_after_payment - total_amount, 0) as surplus_after_payment,
  paid_after_payment > total_amount as creates_overpayment
from payment_history
order by created_at, id;

-- OPTION A - Supprimer une ligne de paiement entierement en surplus.
-- Remplace PAYMENT_ID_A_SUPPRIMER par l'id vu dans la verification ci-dessus.
--
-- begin;
-- delete from public.payments
-- where id = 'PAYMENT_ID_A_SUPPRIMER'
--   and order_id = (
--     select o.id
--     from public.orders o
--     join public.clients c on c.id = o.client_id
--     where o.ticket_number = '2604271552Q73E'
--       and c.name ilike '%essono%'
--   );
--
-- update public.orders o
-- set
--   paid_amount = totals.paid_amount,
--   is_paid = totals.paid_amount >= coalesce(o.total_amount, 0)
-- from (
--   select
--     order_id,
--     greatest(
--       0,
--       coalesce(
--         sum(case when payment_type::text = 'refund' then -amount else amount end),
--         0
--       )
--     ) as paid_amount
--   from public.payments
--   where order_id = (
--     select o.id
--     from public.orders o
--     join public.clients c on c.id = o.client_id
--     where o.ticket_number = '2604271552Q73E'
--       and c.name ilike '%essono%'
--   )
--   group by order_id
-- ) totals
-- where o.id = totals.order_id;
-- commit;

-- OPTION B - Corriger le montant du paiement qui depasse, sans supprimer la ligne.
-- A utiliser si la derniere ligne contient le vrai solde + un surplus.
-- Remplace PAYMENT_ID_A_CORRIGER par l'id du paiement fautif.
--
-- begin;
-- with target_payment as (
--   select p.id, p.order_id
--   from public.payments p
--   join public.orders o on o.id = p.order_id
--   join public.clients c on c.id = o.client_id
--   where p.id = 'PAYMENT_ID_A_CORRIGER'
--     and o.ticket_number = '2604271552Q73E'
--     and c.name ilike '%essono%'
-- ),
-- paid_before_target as (
--   select
--     tp.id as payment_id,
--     tp.order_id,
--     coalesce(
--       sum(case when p.payment_type::text = 'refund' then -p.amount else p.amount end),
--       0
--     ) as paid_before
--   from target_payment tp
--   left join public.payments p
--     on p.order_id = tp.order_id
--    and p.id <> tp.id
--   group by tp.id, tp.order_id
-- ),
-- corrected_amount as (
--   select
--     pbt.payment_id,
--     greatest(0, o.total_amount - pbt.paid_before) as amount_to_keep
--   from paid_before_target pbt
--   join public.orders o on o.id = pbt.order_id
-- )
-- update public.payments p
-- set amount = ca.amount_to_keep
-- from corrected_amount ca
-- where p.id = ca.payment_id;
--
-- update public.orders o
-- set
--   paid_amount = totals.paid_amount,
--   is_paid = totals.paid_amount >= coalesce(o.total_amount, 0)
-- from (
--   select
--     order_id,
--     greatest(
--       0,
--       coalesce(
--         sum(case when payment_type::text = 'refund' then -amount else amount end),
--         0
--       )
--     ) as paid_amount
--   from public.payments
--   where order_id = (
--     select o.id
--     from public.orders o
--     join public.clients c on c.id = o.client_id
--     where o.ticket_number = '2604271552Q73E'
--       and c.name ilike '%essono%'
--   )
--   group by order_id
-- ) totals
-- where o.id = totals.order_id;
-- commit;
