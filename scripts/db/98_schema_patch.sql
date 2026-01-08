-- Database patch: safe schema fixes for existing environments

create unique index if not exists buyer_list_consent_email_list_unique
  on public.buyer_list_consent (email_norm, list_id);

alter table public.email_templates
  add column if not exists subject text,
  add column if not exists template_kind text not null default 'template',
  add column if not exists created_by uuid default auth.uid();
