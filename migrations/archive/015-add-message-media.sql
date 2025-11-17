-- enables MMS storage by adding an array column for attachment URLs
ALTER TABLE messages ADD COLUMN media_urls text[];
