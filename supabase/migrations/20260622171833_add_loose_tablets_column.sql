-- Track leftover tablets from partial strip sales.
-- loose_tablets is in range [0, tablets_per_strip - 1].
-- Full stock in tablets = quantity * tablets_per_strip + loose_tablets.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS loose_tablets integer NOT NULL DEFAULT 0
    CHECK (loose_tablets >= 0);
