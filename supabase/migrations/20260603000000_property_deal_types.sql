-- Add-property deal-type model: cash vs creative finance (owner finance,
-- subject-to, land contract) plus a vacant-only lockbox code. Everything is
-- additive and nullable so existing properties are unaffected. Apply BEFORE
-- deploying the wizard changes that write these columns.
alter table public.properties
  add column if not exists deal_type text default 'cash',
  add column if not exists finance_subtype text,
  add column if not exists down_payment numeric,
  add column if not exists monthly_payment numeric,
  add column if not exists interest_rate numeric,
  add column if not exists term_months integer,
  add column if not exists balloon_months integer,
  add column if not exists existing_loan_balance numeric,
  add column if not exists lockbox_code text;
