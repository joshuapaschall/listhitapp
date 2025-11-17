-- DISPOSITION TOOL - ENABLE SECURITY
-- Run this SECOND - Enables RLS and default policies for all tables

-- Enable Row Level Security on core tables
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE showings ENABLE ROW LEVEL SECURITY;
ALTER TABLE negative_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- Buyers policies
DROP POLICY IF EXISTS "buyers_select" ON buyers;
CREATE POLICY "buyers_select" ON buyers
FOR SELECT USING (true);

DROP POLICY IF EXISTS "buyers_write" ON buyers;
CREATE POLICY "buyers_write" ON buyers
FOR ALL USING (true)
WITH CHECK (true);

-- Tags policies
DROP POLICY IF EXISTS "tags_select" ON tags;
CREATE POLICY "tags_select" ON tags
FOR SELECT USING (true);

DROP POLICY IF EXISTS "tags_write" ON tags;
CREATE POLICY "tags_write" ON tags
FOR ALL USING (true)
WITH CHECK (true);

-- Groups policies
DROP POLICY IF EXISTS "groups_select" ON groups;
CREATE POLICY "groups_select" ON groups
FOR SELECT USING (true);

DROP POLICY IF EXISTS "groups_write" ON groups;
CREATE POLICY "groups_write" ON groups
FOR ALL USING (true)
WITH CHECK (true);

-- Buyer Groups policies
DROP POLICY IF EXISTS "buyer_groups_select" ON buyer_groups;
CREATE POLICY "buyer_groups_select" ON buyer_groups
FOR SELECT USING (true);

DROP POLICY IF EXISTS "buyer_groups_write" ON buyer_groups;
CREATE POLICY "buyer_groups_write" ON buyer_groups
FOR ALL USING (true)
WITH CHECK (true);

-- Properties policies
DROP POLICY IF EXISTS "properties_select" ON properties;
CREATE POLICY "properties_select" ON properties
FOR SELECT USING (true);

DROP POLICY IF EXISTS "properties_write" ON properties;
CREATE POLICY "properties_write" ON properties
FOR ALL USING (true)
WITH CHECK (true);

-- Property Images policies
DROP POLICY IF EXISTS "property_images_select" ON property_images;
CREATE POLICY "property_images_select" ON property_images
FOR SELECT USING (true);

DROP POLICY IF EXISTS "property_images_write" ON property_images;
CREATE POLICY "property_images_write" ON property_images
FOR ALL USING (true)
WITH CHECK (true);

-- Property Buyers policies
DROP POLICY IF EXISTS "property_buyers_select" ON property_buyers;
CREATE POLICY "property_buyers_select" ON property_buyers
FOR SELECT USING (true);

DROP POLICY IF EXISTS "property_buyers_write" ON property_buyers;
CREATE POLICY "property_buyers_write" ON property_buyers
FOR ALL USING (true)
WITH CHECK (true);

-- Showings policies
DROP POLICY IF EXISTS "showings_select" ON showings;
CREATE POLICY "showings_select" ON showings
FOR SELECT USING (true);

DROP POLICY IF EXISTS "showings_write" ON showings;
CREATE POLICY "showings_write" ON showings
FOR ALL USING (true)
WITH CHECK (true);

-- Negative Keywords policies
DROP POLICY IF EXISTS "negative_keywords_select" ON negative_keywords;
CREATE POLICY "negative_keywords_select" ON negative_keywords
FOR SELECT USING (true);

DROP POLICY IF EXISTS "negative_keywords_write" ON negative_keywords;
CREATE POLICY "negative_keywords_write" ON negative_keywords
FOR ALL USING (true)
WITH CHECK (true);

-- Message Threads policies
DROP POLICY IF EXISTS "message_threads_select" ON message_threads;
CREATE POLICY "message_threads_select" ON message_threads
FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "message_threads_write" ON message_threads;
CREATE POLICY "message_threads_write" ON message_threads
FOR ALL USING (true)
WITH CHECK (true);

-- Messages policies
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "messages_write" ON messages;
CREATE POLICY "messages_write" ON messages
FOR ALL USING (true)
WITH CHECK (true);

-- Gmail Threads policies
DROP POLICY IF EXISTS "gmail_threads_select" ON gmail_threads;
CREATE POLICY "gmail_threads_select" ON gmail_threads
FOR SELECT USING (true);

DROP POLICY IF EXISTS "gmail_threads_write" ON gmail_threads;
CREATE POLICY "gmail_threads_write" ON gmail_threads
FOR ALL USING (true)
WITH CHECK (true);

-- Email Threads policies
DROP POLICY IF EXISTS "email_threads_select" ON email_threads;
CREATE POLICY "email_threads_select" ON email_threads
FOR SELECT USING (true);

DROP POLICY IF EXISTS "email_threads_write" ON email_threads;
CREATE POLICY "email_threads_write" ON email_threads
FOR ALL USING (true)
WITH CHECK (true);

-- Email Messages policies
DROP POLICY IF EXISTS "email_messages_select" ON email_messages;
CREATE POLICY "email_messages_select" ON email_messages
FOR SELECT USING (true);

DROP POLICY IF EXISTS "email_messages_write" ON email_messages;
CREATE POLICY "email_messages_write" ON email_messages
FOR ALL USING (true)
WITH CHECK (true);
