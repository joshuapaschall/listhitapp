-- Add deal economics foundations and task records for org-scoped dashboard data.

BEGIN;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS buy_price numeric;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS accepted_price numeric,
  ADD COLUMN IF NOT EXISTS assignment_fee numeric,
  ADD COLUMN IF NOT EXISTS deal_expenses numeric,
  ADD COLUMN IF NOT EXISTS countered_at timestamptz;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

CREATE INDEX IF NOT EXISTS campaigns_property_id_idx ON public.campaigns(property_id);

CREATE TABLE IF NOT EXISTS public.dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.buyers(id),
  accepted_offer_id uuid REFERENCES public.offers(id),
  deal_type text,
  close_type text,
  sale_status text NOT NULL DEFAULT 'pending',
  buy_price numeric,
  sale_price numeric,
  assignment_fee numeric,
  rehab_budget numeric,
  selling_marketed_price numeric,
  closing_expenses numeric,
  emd_amount numeric,
  seller_contract_accepted_date date,
  inspection_period_end date,
  scheduled_close_date date,
  buyer_contract_accepted_date date,
  under_contract_date date,
  under_contract_buyer_date date,
  closing_date date,
  title_agent text,
  title_company text,
  title_received_emd boolean,
  wholesale_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketing_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispositions_org_id_idx ON public.dispositions(org_id);
CREATE INDEX IF NOT EXISTS dispositions_property_id_idx ON public.dispositions(property_id);
CREATE INDEX IF NOT EXISTS dispositions_sale_status_idx ON public.dispositions(sale_status);
CREATE INDEX IF NOT EXISTS dispositions_closing_date_idx ON public.dispositions(closing_date);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL,
  due_date date,
  completed_at timestamptz,
  related_property_id uuid REFERENCES public.properties(id),
  related_buyer_id uuid REFERENCES public.buyers(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_org_id_idx ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks(due_date);

ALTER TABLE public.dispositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispositions_org_select ON public.dispositions;
CREATE POLICY dispositions_org_select ON public.dispositions FOR SELECT TO authenticated USING (org_id = auth_org_id());

DROP POLICY IF EXISTS dispositions_org_insert ON public.dispositions;
CREATE POLICY dispositions_org_insert ON public.dispositions FOR INSERT TO authenticated WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS dispositions_org_update ON public.dispositions;
CREATE POLICY dispositions_org_update ON public.dispositions FOR UPDATE TO authenticated USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS dispositions_org_delete ON public.dispositions;
CREATE POLICY dispositions_org_delete ON public.dispositions FOR DELETE TO authenticated USING (org_id = auth_org_id());

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_org_select ON public.tasks;
CREATE POLICY tasks_org_select ON public.tasks FOR SELECT TO authenticated USING (org_id = auth_org_id());

DROP POLICY IF EXISTS tasks_org_insert ON public.tasks;
CREATE POLICY tasks_org_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS tasks_org_update ON public.tasks;
CREATE POLICY tasks_org_update ON public.tasks FOR UPDATE TO authenticated USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS tasks_org_delete ON public.tasks;
CREATE POLICY tasks_org_delete ON public.tasks FOR DELETE TO authenticated USING (org_id = auth_org_id());

COMMIT;
