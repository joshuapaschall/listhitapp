ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyers_select_authenticated" ON public.buyers;
CREATE POLICY "buyers_select_authenticated"
  ON public.buyers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "buyers_insert_authenticated" ON public.buyers;
CREATE POLICY "buyers_insert_authenticated"
  ON public.buyers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "buyers_update_authenticated" ON public.buyers;
CREATE POLICY "buyers_update_authenticated"
  ON public.buyers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "buyers_delete_authenticated" ON public.buyers;
CREATE POLICY "buyers_delete_authenticated"
  ON public.buyers
  FOR DELETE
  TO authenticated
  USING (true);
