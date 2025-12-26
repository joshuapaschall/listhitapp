-- Ensure campaigns track timezone for scheduling
alter table campaigns
add column if not exists timezone text;

-- Default legacy rows to Eastern to match existing scheduling behavior
update campaigns
set timezone = 'America/New_York'
where timezone is null;
