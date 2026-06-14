-- Run this SQL in your Supabase SQL Editor to add the is_partner_paid column
-- This allows tracking the payment status of partners for each order item manually.

ALTER TABLE "public"."order_items" ADD COLUMN IF NOT EXISTS "is_partner_paid" BOOLEAN DEFAULT false;
