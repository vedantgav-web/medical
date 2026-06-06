/*
  # Medical & General Store Inventory & Billing Schema

  ## New Tables

  ### 1. products
  - `id` (uuid, primary key) - Unique product identifier
  - `name` (text) - Product name
  - `specifications` (text) - Product specs/description
  - `batch_number` (text) - Manufacturing batch number
  - `quantity` (integer) - Current stock count
  - `min_threshold` (integer) - Low stock alert threshold
  - `single_price` (numeric) - Price per unit
  - `total_price` (numeric) - Auto-calculated: quantity * single_price
  - `mfg_date` (date) - Manufacturing date
  - `expiry_date` (date) - Expiry date
  - `drawer_number` (text) - Physical storage location
  - `status` (text) - 'Good' or 'Expired', auto-managed via trigger

  ### 2. bills
  - `id` (serial, primary key) - Auto-incremented bill ID
  - `customer_name` (text) - Customer's name
  - `customer_phone` (text) - Customer's phone number
  - `payment_method` (text) - 'Cash', 'UPI', or 'Card'
  - `total_amount` (numeric) - Total bill amount
  - `created_at` (timestamptz) - Timestamp of sale

  ### 3. bill_items
  - `id` (serial, primary key) - Auto-incremented item ID
  - `bill_id` (integer) - FK to bills
  - `product_id` (uuid) - FK to products
  - `quantity_sold` (integer) - Units sold
  - `price_per_unit` (numeric) - Price at time of sale

  ## Security
  - RLS enabled on all tables
  - Anon role has full access (no auth required per requirements)

  ## Triggers
  - Auto-update `total_price` when quantity or single_price changes
  - Auto-update `status` based on expiry_date vs current date
*/

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specifications text DEFAULT '',
  batch_number text DEFAULT '',
  quantity integer NOT NULL DEFAULT 0,
  min_threshold integer NOT NULL DEFAULT 0,
  single_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) GENERATED ALWAYS AS (quantity * single_price) STORED,
  mfg_date date,
  expiry_date date,
  drawer_number text DEFAULT '',
  status text NOT NULL DEFAULT 'Good' CHECK (status IN ('Good', 'Expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id serial PRIMARY KEY,
  customer_name text NOT NULL,
  customer_phone text DEFAULT '',
  payment_method text NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Card')),
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Bill items table
CREATE TABLE IF NOT EXISTS bill_items (
  id serial PRIMARY KEY,
  bill_id integer NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_sold integer NOT NULL DEFAULT 1,
  price_per_unit numeric(10,2) NOT NULL DEFAULT 0
);

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products (anon access since no auth required)
CREATE POLICY "Allow anon select products"
  ON products FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert products"
  ON products FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update products"
  ON products FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete products"
  ON products FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for bills
CREATE POLICY "Allow anon select bills"
  ON bills FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert bills"
  ON bills FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update bills"
  ON bills FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete bills"
  ON bills FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for bill_items
CREATE POLICY "Allow anon select bill_items"
  ON bill_items FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert bill_items"
  ON bill_items FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update bill_items"
  ON bill_items FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete bill_items"
  ON bill_items FOR DELETE
  TO anon
  USING (true);

-- Function to auto-update status based on expiry date
CREATE OR REPLACE FUNCTION update_product_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'Expired';
  ELSE
    NEW.status := 'Good';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-update status on insert or update
DROP TRIGGER IF EXISTS trigger_update_product_status ON products;
CREATE TRIGGER trigger_update_product_status
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_status();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_product_id ON bill_items(product_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
