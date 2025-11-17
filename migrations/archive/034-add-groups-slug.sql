-- Add slug column to groups and backfill existing rows
alter table groups add column if not exists slug text;

-- Normalize empty strings to null for slug
update groups set slug = null where slug = '';

with generated_slugs as (
  select
    id,
    lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g')) as base_slug
  from groups
  where slug is null
),
ranked as (
  select
    id,
    base_slug,
    case
      when base_slug = '' then substr(id::text, 1, 12)
      else base_slug
    end as effective_base,
    row_number() over (
      partition by case when base_slug = '' then substr(id::text, 1, 12) else base_slug end
      order by id
    ) as slug_index
  from generated_slugs
),
slug_values as (
  select
    id,
    case
      when slug_index = 1 then effective_base
      else effective_base || '-' || (slug_index - 1)::text
    end as new_slug
  from ranked
)
update groups g
set slug = new_slug
from slug_values s
where g.id = s.id;

-- Ensure slug uniqueness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'groups_slug_key'
  ) THEN
    ALTER TABLE groups
      ADD CONSTRAINT groups_slug_key UNIQUE (slug);
  END IF;
END $$;
