DROP POLICY IF EXISTS "buyers_select_authenticated" ON public.buyers;
DROP POLICY IF EXISTS "buyers_insert_authenticated" ON public.buyers;
DROP POLICY IF EXISTS "buyers_update_authenticated" ON public.buyers;
DROP POLICY IF EXISTS "buyers_delete_authenticated" ON public.buyers;

ALTER TABLE public.buyers DISABLE ROW LEVEL SECURITY;
