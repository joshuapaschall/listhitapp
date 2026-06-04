-- Lock down public-role RLS access on buyers and properties tables
-- Removes the four overly-permissive {public} role policies.
-- {authenticated} and {service_role} policies remain intact.

DROP POLICY IF EXISTS buyers_select ON public.buyers;
DROP POLICY IF EXISTS buyers_write ON public.buyers;
DROP POLICY IF EXISTS properties_select ON public.properties;
DROP POLICY IF EXISTS properties_write ON public.properties;
