-- Add tablet-level billing support to products
-- tablets_per_strip: how many tablets in one strip/pack (e.g. 10, 15, 20). 0 = not applicable.
-- sell_by_tablet: whether this product can be sold as loose tablets (true) or only whole strips (false)
-- tablet_price: price per single tablet. If 0/NULL, derived as single_price / tablets_per_strip at billing time.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tablets_per_strip integer NOT NULL DEFAULT 0
    CHECK (tablets_per_strip >= 0),
  ADD COLUMN IF NOT EXISTS sell_by_tablet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tablet_price numeric(10,2) NOT NULL DEFAULT 0
    CHECK (tablet_price >= 0);

-- Helpful index for paginated inventory queries ordered by created_at
CREATE INDEX IF NOT EXISTS idx_products_user_created_at ON products(user_id, created_at DESC);
