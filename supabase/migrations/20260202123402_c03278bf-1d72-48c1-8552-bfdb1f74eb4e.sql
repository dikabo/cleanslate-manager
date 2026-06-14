-- Fix search_path on trigger functions for security
ALTER FUNCTION public.generate_ticket_number() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_partner_rating() SET search_path = public;