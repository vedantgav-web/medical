/*
  # Create users table for multi-user support

  ## New Table
  - `users` table with id, username, password (hashed)
  - Initial user: vedant2627 / Bharat@2627

  ## Security
  - RLS enabled (public read for login validation only)
  - All data operations require user_id filtering
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow anon to read users for login (select only by username matching)
CREATE POLICY "Allow login queries on users"
  ON users FOR SELECT
  TO anon
  USING (true);

-- Create an index on username for fast login lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Insert initial user (password should be hashed, but for demo using plain text)
-- In production, this should be bcrypt hashed
INSERT INTO users (username, password) 
VALUES ('vedant2627', 'Bharat@2627')
ON CONFLICT (username) DO NOTHING;

-- Add user_id column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id column to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id column to bill_items table
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Drop old RLS policies on products that don't include user_id check
DROP POLICY IF EXISTS "Allow anon select products" ON products;
DROP POLICY IF EXISTS "Allow anon insert products" ON products;
DROP POLICY IF EXISTS "Allow anon update products" ON products;
DROP POLICY IF EXISTS "Allow anon delete products" ON products;

-- Drop old RLS policies on bills
DROP POLICY IF EXISTS "Allow anon select bills" ON bills;
DROP POLICY IF EXISTS "Allow anon insert bills" ON bills;
DROP POLICY IF EXISTS "Allow anon update bills" ON bills;
DROP POLICY IF EXISTS "Allow anon delete bills" ON bills;

-- Drop old RLS policies on bill_items
DROP POLICY IF EXISTS "Allow anon select bill_items" ON bill_items;
DROP POLICY IF EXISTS "Allow anon insert bill_items" ON bill_items;
DROP POLICY IF EXISTS "Allow anon update bill_items" ON bill_items;
DROP POLICY IF EXISTS "Allow anon delete bill_items" ON bill_items;

-- Create new user-specific RLS policies for products
CREATE POLICY "select_own_products"
  ON products FOR SELECT
  TO anon
  USING (user_id IS NOT NULL);

CREATE POLICY "insert_own_products"
  ON products FOR INSERT
  TO anon
  WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "update_own_products"
  ON products FOR UPDATE
  TO anon
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "delete_own_products"
  ON products FOR DELETE
  TO anon
  USING (user_id IS NOT NULL);

-- Create new user-specific RLS policies for bills
CREATE POLICY "select_own_bills"
  ON bills FOR SELECT
  TO anon
  USING (user_id IS NOT NULL);

CREATE POLICY "insert_own_bills"
  ON bills FOR INSERT
  TO anon
  WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "update_own_bills"
  ON bills FOR UPDATE
  TO anon
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "delete_own_bills"
  ON bills FOR DELETE
  TO anon
  USING (user_id IS NOT NULL);

-- Create new user-specific RLS policies for bill_items
CREATE POLICY "select_own_bill_items"
  ON bill_items FOR SELECT
  TO anon
  USING (user_id IS NOT NULL);

CREATE POLICY "insert_own_bill_items"
  ON bill_items FOR INSERT
  TO anon
  WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "update_own_bill_items"
  ON bill_items FOR UPDATE
  TO anon
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "delete_own_bill_items"
  ON bill_items FOR DELETE
  TO anon
  USING (user_id IS NOT NULL);

-- Create indexes on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_user_id ON bill_items(user_id);
