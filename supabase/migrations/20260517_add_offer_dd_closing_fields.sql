-- Add due diligence period and proposed closing date to offers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS due_diligence_days integer;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS proposed_closing_date date;
