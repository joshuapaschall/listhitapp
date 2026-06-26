-- Per-org Twilio resources. One row per org, holding the Twilio resource IDs that
-- later PRs provision (subaccount, profiles, brand/campaign, messaging service,
-- phone number) plus the A2P provisioning status. Populated by later PRs — this
-- migration only creates the table. SMS sending stays on Telnyx until wired.
BEGIN;
CREATE TABLE IF NOT EXISTS public.org_twilio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    sms_provider text NOT NULL DEFAULT 'twilio',
    subaccount_sid text,
    secondary_profile_sid text,
    brand_sid text,
    campaign_sid text,
    messaging_service_sid text,
    phone_number text,
    phone_number_sid text,
    a2p_status text NOT NULL DEFAULT 'not_started',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_twilio_pkey PRIMARY KEY (id),
    CONSTRAINT org_twilio_org_id_key UNIQUE (org_id),
    CONSTRAINT org_twilio_sms_provider_check CHECK (sms_provider = ANY (ARRAY['telnyx','twilio'])),
    CONSTRAINT org_twilio_a2p_status_check CHECK (a2p_status = ANY (ARRAY['not_started','provisioning','brand_pending','campaign_pending','verified','failed'])),
    CONSTRAINT org_twilio_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_twilio_org_id ON public.org_twilio USING btree (org_id);

ALTER TABLE public.org_twilio ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_twilio_org_select ON public.org_twilio
    FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));
CREATE POLICY org_twilio_org_insert ON public.org_twilio
    FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));
CREATE POLICY org_twilio_org_update ON public.org_twilio
    FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));
CREATE POLICY org_twilio_org_delete ON public.org_twilio
    FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));
COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.org_twilio;
-- COMMIT;
