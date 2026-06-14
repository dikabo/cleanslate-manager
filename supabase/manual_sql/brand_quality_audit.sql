-- Audit des marques saisies dans les commandes/articles.
-- A coller dans Supabase SQL Editor. Ces requetes ne modifient aucune donnee.
--
-- Objectif:
-- 1. Extraire la liste des marques existantes.
-- 2. Reperer les doublons de casse/espaces/ponctuation.
-- 3. Proposer des paires de marques probablement proches pour correction manuelle.

-- Optionnel mais utile pour la detection de similarite.
-- Si Supabase indique que l'extension existe deja, c'est normal.
create extension if not exists pg_trgm;

-- =========================================================
-- 1) Liste consolidee des marques, en partant des articles
--    et en incluant le champ historique orders.brand.
-- =========================================================
with brand_sources as (
  select
    'order_articles' as source_table,
    oa.id as source_id,
    oa.order_id,
    o.ticket_number,
    oa.position as article_position,
    oa.brand,
    oa.created_at
  from public.order_articles oa
  join public.orders o on o.id = oa.order_id
  where oa.brand is not null and btrim(oa.brand) <> ''

  union all

  select
    'orders' as source_table,
    o.id as source_id,
    o.id as order_id,
    o.ticket_number,
    1 as article_position,
    o.brand,
    o.created_at
  from public.orders o
  where o.brand is not null and btrim(o.brand) <> ''
),
normalized as (
  select
    *,
    lower(regexp_replace(btrim(brand), '\s+', ' ', 'g')) as normalized_brand,
    regexp_replace(lower(btrim(brand)), '[^a-z0-9]+', '', 'g') as compact_brand
  from brand_sources
)
select
  compact_brand,
  normalized_brand,
  count(*) as occurrences,
  count(distinct order_id) as orders_count,
  array_agg(distinct brand order by brand) as variants,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from normalized
group by compact_brand, normalized_brand
order by occurrences desc, normalized_brand;

-- =========================================================
-- 2) Valeurs suspectes faciles: espaces, casse incoherente,
--    ponctuation, valeurs tres courtes.
-- =========================================================
with brand_sources as (
  select
    'order_articles' as source_table,
    oa.id as source_id,
    oa.order_id,
    o.ticket_number,
    oa.position as article_position,
    oa.brand,
    oa.created_at
  from public.order_articles oa
  join public.orders o on o.id = oa.order_id
  where oa.brand is not null and btrim(oa.brand) <> ''

  union all

  select
    'orders' as source_table,
    o.id as source_id,
    o.id as order_id,
    o.ticket_number,
    1 as article_position,
    o.brand,
    o.created_at
  from public.orders o
  where o.brand is not null and btrim(o.brand) <> ''
)
select
  source_table,
  source_id,
  ticket_number,
  article_position,
  brand,
  case
    when brand <> btrim(brand) then 'espaces debut/fin'
    when brand ~ '\s{2,}' then 'espaces multiples'
    when length(btrim(brand)) <= 2 then 'marque tres courte'
    when brand ~ '[,;:_/\\|]' then 'ponctuation inhabituelle'
    when brand = lower(brand) then 'tout en minuscules'
    when brand = upper(brand) and length(brand) > 3 then 'tout en majuscules'
    else 'a verifier'
  end as suspicion
from brand_sources
where
  brand <> btrim(brand)
  or brand ~ '\s{2,}'
  or length(btrim(brand)) <= 2
  or brand ~ '[,;:_/\\|]'
  or brand = lower(brand)
  or (brand = upper(brand) and length(brand) > 3)
order by suspicion, brand, created_at desc;

-- =========================================================
-- 3) Paires de marques proches: utile pour reperer
--    "Louis Vuitton" vs "Luis Vuitton", "Nike" vs "Nikke", etc.
--    Ajuster le seuil 0.45 si la liste est trop large ou trop courte.
-- =========================================================
with brand_sources as (
  select oa.brand
  from public.order_articles oa
  where oa.brand is not null and btrim(oa.brand) <> ''

  union all

  select o.brand
  from public.orders o
  where o.brand is not null and btrim(o.brand) <> ''
),
brand_counts as (
  select
    regexp_replace(lower(btrim(brand)), '[^a-z0-9]+', '', 'g') as compact_brand,
    lower(regexp_replace(btrim(brand), '\s+', ' ', 'g')) as normalized_brand,
    count(*) as occurrences,
    array_agg(distinct brand order by brand) as variants
  from brand_sources
  group by 1, 2
),
pairs as (
  select
    a.normalized_brand as brand_a,
    a.occurrences as occurrences_a,
    a.variants as variants_a,
    b.normalized_brand as brand_b,
    b.occurrences as occurrences_b,
    b.variants as variants_b,
    similarity(a.compact_brand, b.compact_brand) as similarity_score
  from brand_counts a
  join brand_counts b
    on a.compact_brand < b.compact_brand
  where
    length(a.compact_brand) >= 3
    and length(b.compact_brand) >= 3
    and similarity(a.compact_brand, b.compact_brand) >= 0.45
)
select *
from pairs
order by similarity_score desc, (occurrences_a + occurrences_b) desc;

-- =========================================================
-- 4) Extraction detaillee pour correction manuelle.
--    Exportable en CSV depuis Supabase.
-- =========================================================
select
  o.ticket_number,
  o.created_at::date as order_date,
  oa.id as article_id,
  oa.order_id,
  oa.position,
  oa.article_type,
  oa.material,
  oa.brand,
  lower(regexp_replace(btrim(oa.brand), '\s+', ' ', 'g')) as suggested_normalized_brand,
  oa.color,
  oa.description
from public.order_articles oa
join public.orders o on o.id = oa.order_id
where oa.brand is not null and btrim(oa.brand) <> ''
order by suggested_normalized_brand, o.created_at desc, oa.position;
