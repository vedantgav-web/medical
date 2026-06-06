/*
  # Remove manufacture date column

  ## Changes
  - Remove `mfg_date` column from `products` table
  - Update trigger function to remove mfg_date reference

  ## Notes
  - This is a destructive operation that removes the column
  - No data will be lost as this is for the manufacture date feature removal
*/

-- Drop the column from products table
ALTER TABLE products DROP COLUMN IF EXISTS mfg_date;
