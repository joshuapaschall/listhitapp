ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS design_json jsonb,
  ADD COLUMN IF NOT EXISTS mjml text;
