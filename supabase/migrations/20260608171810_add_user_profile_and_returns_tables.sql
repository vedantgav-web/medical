/*
  # Add user profile fields and returns tables

  ## Users table changes
  - Add store_name, address, email columns
  - Add status column (active/inactive) for service gating

  ## New tables
  - customer_returns: tracks products returned by customers
  - wholeseller_returns: tracks expired products returned to wholeseller
*/

-- Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_name text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS address text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Update the initial user with store info
UPDATE users SET store_name = 'MediStore', status = 'active' WHERE username = 'vedant2627';

-- Create customer_returns table
CREATE TABLE IF NOT EXISTS customer_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  batch_number text DEFAULT '',
  quantity integer NOT NULL,
  return_type text NOT NULL CHECK (return_type IN ('refund', 'exchange')),
  refund_amount numeric DEFAULT 0,
  exchange_product_id uuid,
  exchange_product_name text DEFAULT '',
  exchange_quantity integer DEFAULT 0,
  customer_name text DEFAULT '',
  customer_phone text DEFAULT '',
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create wholeseller_returns table
CREATE TABLE IF NOT EXISTS wholeseller_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  batch_number text DEFAULT '',
  quantity integer NOT NULL,
  wholeseller_name text DEFAULT '',
  reason text DEFAULT '',
  refund_amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholeseller_returns ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_returns
CREATE POLICY "select_own_customer_returns" ON customer_returns FOR SELECT TO anon USING (user_id IS NOT NULL);
CREATE POLICY "insert_own_customer_returns" ON customer_returns FOR INSERT TO anon WITH CHECK (user_id IS NOT NULL);
CREATE POLICY "update_own_customer_returns" ON customer_returns FOR UPDATE TO anon USING (user_id IS NOT NULL) WITH CHECK (user_id IS NOT NULL);
CREATE POLICY "delete_own_customer_returns" ON customer_returns FOR DELETE TO anon USING (user_id IS NOT NULL);

-- RLS policies for wholeseller_returns
CREATE POLICY "select_own_wholeseller_returns" ON wholeseller_returns FOR SELECT TO anon USING (user_id IS NOT NULL);
CREATE POLICY "insert_own_wholeseller_returns" ON wholeseller_returns FOR INSERT TO anon WITH CHECK (user_id IS NOT NULL);
CREATE POLICY "update_own_wholeseller_returns" ON wholeseller_returns FOR UPDATE TO anon USING (user_id IS NOT NULL) WITH CHECK (user_id IS NOT NULL);
CREATE POLICY "delete_own_wholeseller_returns" ON wholeseller_returns FOR DELETE TO anon USING (user_id IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_returns_user_id ON customer_returns(user_id);
CREATE INDEX IF NOT EXISTS idx_wholeseller_returns_user_id ON wholeseller_returns(user_id);
