-- Onboarding step progress, one row per (org, step). Mirrors the markets org-scoped pattern.
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    step_key text NOT NULL,
    status text NOT NULL DEFAULT 'not_started',
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id),
    CONSTRAINT onboarding_progress_org_step_key UNIQUE (org_id, step_key),
    CONSTRAINT onboarding_progress_status_check CHECK (status = ANY (ARRAY['not_started','in_progress','done','skipped'])),
    CONSTRAINT onboarding_progress_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_org_id ON public.onboarding_progress USING btree (org_id);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_progress_org_select ON public.onboarding_progress
    FOR SELECT TO authenticated USING ((org_id = public.auth_org_id()));
CREATE POLICY onboarding_progress_org_insert ON public.onboarding_progress
    FOR INSERT TO authenticated WITH CHECK ((org_id = public.auth_org_id()));
CREATE POLICY onboarding_progress_org_update ON public.onboarding_progress
    FOR UPDATE TO authenticated USING ((org_id = public.auth_org_id())) WITH CHECK ((org_id = public.auth_org_id()));
CREATE POLICY onboarding_progress_org_delete ON public.onboarding_progress
    FOR DELETE TO authenticated USING ((org_id = public.auth_org_id()));
