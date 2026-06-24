-- Allow products to be deleted even when bill_items reference them.
-- Bill history is preserved: product_id becomes NULL on the bill_item instead of blocking deletion.
ALTER TABLE bill_items DROP CONSTRAINT IF EXISTS bill_items_product_id_fkey;
ALTER TABLE bill_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE bill_items
  ADD CONSTRAINT bill_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
