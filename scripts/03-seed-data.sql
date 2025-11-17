-- DISPOSITION TOOL - SEED ALL DATA
-- Run this THIRD - Seeds tags, groups, and sample buyers

-- Insert comprehensive tag set
INSERT INTO tags (name, color, is_protected, usage_count) VALUES
  -- Core VIP/Priority Tags
  ('VIP', '#FFD700', true, 0),
  ('Hot Lead', '#FF4444', true, 0),
  
  -- Buyer Types
  ('Investor', '#9C27B0', true, 0),
  ('Cash Buyer', '#00BCD4', true, 0),
  ('First-time Buyer', '#4CAF50', false, 0),
  ('Retail Buyer', '#7C3AED', false, 0),
  ('Relocating', '#FF9800', false, 0),
  
  -- Investment Strategies
  ('Buy and Hold', '#8B5CF6', true, 0),
  ('Fix and Flips', '#F97316', true, 0),
  ('BRRRR Strategy', '#16A34A', false, 0),
  ('Wholesaler', '#0891B2', true, 0),
  ('Daisy Chainer', '#EF4444', true, 0),
  
  -- Financing Types
  ('Creative Finance', '#F59E0B', true, 0),
  ('Hard Money', '#6366F1', true, 0),
  ('Owner Financing', '#DC2626', true, 0),
  ('Rent to Own', '#DB2777', true, 0),
  ('SUB2', '#EA580C', true, 0),
  
  -- Professional Categories
  ('Realtor', '#2563EB', true, 0),
  ('Developer/Home Builder', '#10B981', true, 0),
  ('Landlord', '#059669', true, 0),
  ('Hedgefund', '#8B5CF6', true, 0),
  
  -- Property Preferences
  ('Turnkey Properties', '#8B5CF6', false, 0),
  ('Fixer Upper', '#F97316', false, 0),
  ('New Construction', '#10B981', false, 0),
  ('Luxury Market', '#FFD700', false, 0),
  ('Commercial', '#6B7280', false, 0),
  ('Land Development', '#84CC16', false, 0),
  ('Section 8 Friendly', '#0EA5E9', false, 0)
ON CONFLICT (name) DO NOTHING;

-- Slugs keep group URLs deterministic
INSERT INTO groups (name, slug, description, type, color, criteria) VALUES
  ('VIP Buyers', 'vip-buyers', 'High-priority buyers with VIP status', 'smart', '#FFD700', '{"vip": true}'),
  ('Hot Leads', 'hot-leads', 'Buyers ready to purchase immediately', 'smart', '#FF4444', '{"tags": ["Hot Lead"]}'),
  ('Cash Buyers', 'cash-buyers', 'Buyers with cash offers', 'smart', '#00BCD4', '{"cash_buyer": true}'),
  ('Investors', 'investors', 'Investment property buyers', 'smart', '#9C27B0', '{"investor": true}'),
  ('High Score Buyers', 'high-score-buyers', 'Buyers with score 80+', 'smart', '#10B981', '{"score_min": 80}'),
  ('Vetted Buyers', 'vetted-buyers', 'Pre-qualified and vetted buyers', 'smart', '#6366F1', '{"vetted": true}'),
  ('Atlanta Market', 'atlanta-market', 'Buyers interested in Atlanta area', 'smart', '#F59E0B', '{"locations": ["Atlanta"]}'),
  ('Budget 300K+', 'budget-300k-plus', 'Buyers with budget over $300K', 'smart', '#8B5CF6', '{"asking_price_min": 300000}')
ON CONFLICT DO NOTHING;

-- Insert manual groups
INSERT INTO groups (name, slug, description, type, color) VALUES
  ('All Buyers', 'all', 'System default group containing all buyers', 'manual', '#111827'),
  ('Follow Up This Week', 'follow-up-this-week', 'Buyers needing immediate follow-up', 'manual', '#EF4444'),
  ('New Leads', 'new-leads', 'Recently added leads to process', 'manual', '#3B82F6'),
  ('Under Contract', 'under-contract', 'Buyers currently under contract', 'manual', '#059669'),
  ('Past Clients', 'past-clients', 'Previous successful transactions', 'manual', '#6B7280')
ON CONFLICT DO NOTHING;

-- Optional demo call-center agent for local testing
INSERT INTO agents (
  email,
  password_hash,
  display_name,
  sip_username,
  sip_password,
  telephony_credential_id,
  status
) VALUES (
  'agent1@company.com',
  crypt('test123', gen_salt('bf')),
  'Agent One',
  'agent1',
  'test123',
  'REPLACE_WITH_TELNYX_CREDENTIAL_ID',
  'offline'
)
ON CONFLICT (email) DO NOTHING;

-- Insert comprehensive sample buyers
INSERT INTO buyers (
  fname, lname, email, phone, phone2, company,
  score, tags, vip, vetted, status,
  mailing_city, mailing_state, mailing_zip,
  locations, property_type, property_interest,
  asking_price_min, asking_price_max,
  beds_min, baths_min, sqft_min,
  cash_buyer, investor, owner_financing,
  notes
) VALUES 
(
  'John', 'Anderson', 'john.anderson@example.com', '555-123-4567', '555-123-4568', 'Anderson Investments LLC',
  85, ARRAY['Investor', 'Cash Buyer', 'Buy and Hold'], true, true, 'qualified',
  'Atlanta', 'GA', '30309',
  ARRAY['Atlanta, GA', 'Marietta, GA', 'Roswell, GA'],
  ARRAY['single_family', 'multi_family'],
  'Looking for cash-flowing rental properties in good school districts',
  200000, 500000,
  3, 2.0, 1500,
  true, true, false,
  'Serious investor with 10+ properties. Prefers turnkey rentals. Can close in 7-14 days.'
),
(
  'Sarah', 'Johnson', 'sarah.johnson@email.com', '555-987-6543', NULL, NULL,
  90, ARRAY['VIP', 'Hot Lead', 'First-time Buyer'], true, true, 'active',
  'Roswell', 'GA', '30075',
  ARRAY['Roswell, GA', 'Alpharetta, GA', 'Johns Creek, GA'],
  ARRAY['single_family'],
  'First-time homebuyer looking for move-in ready homes in top school districts',
  350000, 550000,
  4, 2.5, 2200,
  false, false, true,
  'Pre-approved for $600K. Looking to move before school year starts. Very motivated.'
),
(
  'Mike', 'Rodriguez', 'mike@flipsmart.com', '555-456-7890', '555-456-7891', 'FlipSmart Properties',
  75, ARRAY['Investor', 'Fix and Flips', 'Hard Money'], false, true, 'qualified',
  'Decatur', 'GA', '30030',
  ARRAY['Decatur, GA', 'Stone Mountain, GA', 'Tucker, GA'],
  ARRAY['single_family', 'townhouse'],
  'Fix and flip investor looking for properties under market value',
  150000, 350000,
  3, 2.0, 1200,
  true, true, false,
  'Experienced flipper. Looks for 70% ARV deals. Has hard money lined up.'
),
(
  'Lisa', 'Chen', 'lisa.chen@gmail.com', '555-321-9876', NULL, 'Chen Real Estate Group',
  70, ARRAY['Realtor', 'Investor', 'Wholesaler'], false, false, 'lead',
  'Sandy Springs', 'GA', '30328',
  ARRAY['Sandy Springs, GA', 'Dunwoody, GA', 'Brookhaven, GA'],
  ARRAY['single_family', 'condo'],
  'Realtor who also invests and wholesales properties',
  250000, 450000,
  2, 2.0, 1000,
  false, true, false,
  'Licensed realtor with investor clients. Good for referrals and joint ventures.'
),
(
  'David', 'Williams', 'david.w@ownerfinance.net', '555-654-3210', NULL, NULL,
  60, ARRAY['Owner Financing', 'Rent to Own', 'Creative Finance'], false, false, 'lead',
  'Lawrenceville', 'GA', '30043',
  ARRAY['Lawrenceville, GA', 'Duluth, GA', 'Suwanee, GA'],
  ARRAY['single_family'],
  'Interested in owner financing and rent-to-own opportunities',
  180000, 320000,
  3, 2.0, 1400,
  false, false, true,
  'Looking for seller financing deals. Can put 10-20% down. Steady income.'
);

-- Update tag usage counts based on sample data
UPDATE tags SET usage_count = (
  SELECT COUNT(*)
  FROM buyers
  WHERE tags @> ARRAY[tags.name]
);

-- Optional sample property and showing
INSERT INTO properties (id, address, status)
VALUES ('00000000-0000-0000-0000-000000000001', '123 Demo St', 'available')
ON CONFLICT (id) DO NOTHING;

INSERT INTO showings (property_id, buyer_id, scheduled_at, status, notes)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM buyers LIMIT 1),
  now() + interval '1 day',
  'scheduled',
  'Demo showing'
);

-- Seed sample message threads and messages for the Inbox
-- five demo threads showcasing inbound, outbound and system events

-- Thread 1: recent inbound (<5 min)
INSERT INTO message_threads (id, buyer_id, phone_number, unread, starred, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  (SELECT id FROM buyers WHERE phone = '555-123-4567'),
  '555-123-4567',
  true,
  false,
  now() - interval '2 minutes'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (thread_id, buyer_id, direction, from_number, to_number, body, provider_id, is_bulk, filtered, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000101', (SELECT id FROM buyers WHERE phone = '555-123-4567'), 'outbound', '+18885550111', '555-123-4567', 'Hi John!', 'seed-0101', false, false, now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-000000000101', (SELECT id FROM buyers WHERE phone = '555-123-4567'), 'inbound', '555-123-4567', '+18885550111', 'Hello!', 'seed-0102', false, false, now() - interval '2 minutes')
ON CONFLICT DO NOTHING;

-- Thread 2: inbound ~10 min ago (red dot)
INSERT INTO message_threads (id, buyer_id, phone_number, unread, starred, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000102',
  (SELECT id FROM buyers WHERE phone = '555-987-6543'),
  '555-987-6543',
  true,
  false,
  now() - interval '10 minutes'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (thread_id, buyer_id, direction, from_number, to_number, body, provider_id, is_bulk, filtered, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000102', (SELECT id FROM buyers WHERE phone = '555-987-6543'), 'outbound', '+18885550111', '555-987-6543', 'Hello Sarah', 'seed-0201', false, false, now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-000000000102', (SELECT id FROM buyers WHERE phone = '555-987-6543'), 'inbound', '555-987-6543', '+18885550111', 'Is this still available?', 'seed-0202', false, false, now() - interval '10 minutes')
ON CONFLICT DO NOTHING;

-- Thread 3: read thread (gray dot)
INSERT INTO message_threads (id, buyer_id, phone_number, unread, starred, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000103',
  (SELECT id FROM buyers WHERE phone = '555-456-7890'),
  '555-456-7890',
  false,
  false,
  now() - interval '15 minutes'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (thread_id, buyer_id, direction, from_number, to_number, body, provider_id, is_bulk, filtered, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000103', (SELECT id FROM buyers WHERE phone = '555-456-7890'), 'outbound', '+18885550111', '555-456-7890', 'Checking in', 'seed-0301', false, false, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-000000000103', (SELECT id FROM buyers WHERE phone = '555-456-7890'), 'inbound', '555-456-7890', '+18885550111', 'All good, thanks!', 'seed-0302', false, false, now() - interval '15 minutes')
ON CONFLICT DO NOTHING;

-- Thread 4: call event
INSERT INTO message_threads (id, buyer_id, phone_number, unread, starred, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000104',
  (SELECT id FROM buyers WHERE phone = '555-321-9876'),
  '555-321-9876',
  true,
  false,
  now() - interval '30 minutes'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (thread_id, buyer_id, direction, from_number, to_number, body, provider_id, is_bulk, filtered, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000104', (SELECT id FROM buyers WHERE phone = '555-321-9876'), 'outbound', '+18885550111', '555-321-9876', 'Can we talk?', 'seed-0401', false, false, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000104', (SELECT id FROM buyers WHERE phone = '555-321-9876'), 'event', NULL, NULL, 'CALL (5 min 40 s)', 'seed-0402', false, false, now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-000000000104', (SELECT id FROM buyers WHERE phone = '555-321-9876'), 'inbound', '555-321-9876', '+18885550111', 'Sure thing', 'seed-0403', false, false, now() - interval '25 minutes')
ON CONFLICT DO NOTHING;

-- Thread 5: unsubscribe event
INSERT INTO message_threads (id, buyer_id, phone_number, unread, starred, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000105',
  (SELECT id FROM buyers WHERE phone = '555-654-3210'),
  '555-654-3210',
  true,
  false,
  now() - interval '40 minutes'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (thread_id, buyer_id, direction, from_number, to_number, body, provider_id, is_bulk, filtered, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000105', (SELECT id FROM buyers WHERE phone = '555-654-3210'), 'outbound', '+18885550111', '555-654-3210', 'Please reply STOP to unsubscribe', 'seed-0501', false, false, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000105', (SELECT id FROM buyers WHERE phone = '555-654-3210'), 'inbound', '555-654-3210', '+18885550111', 'STOP', 'seed-0502', false, false, now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-000000000105', (SELECT id FROM buyers WHERE phone = '555-654-3210'), 'event', NULL, NULL, 'UNSUBSCRIBED', 'seed-0503', false, false, now() - interval '39 minutes')
ON CONFLICT DO NOTHING;


-- Negative keywords (none by default, customize as needed)
-- Example:
-- INSERT INTO negative_keywords (keyword) VALUES ('scam'), ('fraud');
