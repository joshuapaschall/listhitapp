ALTER TABLE public.property_images
ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- When setting a new featured image, we need to unset the old one.
-- This index makes the "unset all for property" query fast.
CREATE INDEX IF NOT EXISTS idx_property_images_featured
ON public.property_images (property_id, is_featured)
WHERE is_featured = true;
