-- Per-org business verification record for A2P. One row per org.
CREATE TABLE IF NOT EXISTS public.business_verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    entity_type text,                         -- 'ein_business' | 'sole_proprietor'
    legal_business_name text,
    ein text,                                 -- business EIN only; NULL for sole proprietors. Never an SSN.
    dba_name text,
    contact_first_name text,
    contact_last_name text,
    contact_email text,
    ein_letter_path text,                     -- storage path in the private bucket
    status text NOT NULL DEFAULT 'draft',     -- 'draft' | 'ready'
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_verification_pkey PRIMARY KEY (id),
    CONSTRAINT business_verification_org_id_key UNIQUE (org_id),
    CONSTRAINT business_verification_entity_type_check CHECK (entity_type IS NULL OR entity_type = ANY (ARRAY['ein_business','sole_proprietor'])),
    CONSTRAINT business_verification_status_check CHECK (status = ANY (ARRAY['draft','ready'])),
    CONSTRAINT business_verification_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_verification_org_id ON public.business_verification USING btree (org_id);

ALTER TABLE public.business_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_verification_org_select ON public.business_verification
    FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));
CREATE POLICY business_verification_org_insert ON public.business_verification
    FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));
CREATE POLICY business_verification_org_update ON public.business_verification
    FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));
CREATE POLICY business_verification_org_delete ON public.business_verification
    FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));

-- Private bucket for the CP-575 letter.
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-verification', 'business-verification', false)
ON CONFLICT (id) DO NOTHING;
