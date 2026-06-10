-- Per-org A2P 10DLC registration record. One row per org. Brand identity is NOT
-- duplicated here — it is assembled at read time from business_verification +
-- organizations. This holds only the campaign/program inputs.
BEGIN;
CREATE TABLE IF NOT EXISTS public.a2p_registration (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    use_case text NOT NULL DEFAULT 'marketing',
    campaign_description text,
    sample_message_1 text,
    sample_message_2 text,
    opt_in_url text,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT a2p_registration_pkey PRIMARY KEY (id),
    CONSTRAINT a2p_registration_org_id_key UNIQUE (org_id),
    CONSTRAINT a2p_registration_status_check CHECK (status = ANY (ARRAY['draft','ready'])),
    CONSTRAINT a2p_registration_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_a2p_registration_org_id ON public.a2p_registration USING btree (org_id);

ALTER TABLE public.a2p_registration ENABLE ROW LEVEL SECURITY;

CREATE POLICY a2p_registration_org_select ON public.a2p_registration
    FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));
CREATE POLICY a2p_registration_org_insert ON public.a2p_registration
    FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));
CREATE POLICY a2p_registration_org_update ON public.a2p_registration
    FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));
CREATE POLICY a2p_registration_org_delete ON public.a2p_registration
    FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));
COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.a2p_registration;
-- COMMIT;
