-- ============================================================
-- KO STORE — SUPABASE DATABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- (Project → SQL Editor → New Query → Paste → Run)
-- ============================================================

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    price        INTEGER NOT NULL,
    type         TEXT NOT NULL,          -- 'shirt' or 'jeans'
    img          TEXT NOT NULL,
    has_colors   BOOLEAN DEFAULT FALSE,
    discount_price   INTEGER,
    discount_percent INTEGER,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INVENTORY TABLE (one row per product/size/color variant)
CREATE TABLE IF NOT EXISTS inventory (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '',  -- 'Black', 'White', or '' for no-color
    quantity   INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, size, color)
);

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         TEXT NOT NULL,
    customer_name    TEXT,
    customer_email   TEXT,
    customer_phone   TEXT,
    customer_address TEXT,
    city             TEXT,
    payment_method   TEXT,
    items            JSONB NOT NULL DEFAULT '[]',
    subtotal         INTEGER NOT NULL DEFAULT 0,
    total            INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    user_id          UUID REFERENCES auth.users(id)
);

-- 4. PROFILES TABLE (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name  TEXT,
    is_admin   BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (tighten later for production)
CREATE POLICY "Public read/write products"  ON products  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write orders"    ON orders    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write profiles"  ON profiles  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, full_name, is_admin)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', FALSE)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SEED INITIAL PRODUCTS
-- ============================================================
INSERT INTO products (id, name, price, type, img, has_colors) VALUES
    ('1', 'Polo T-Shirt',       650,  'shirt', 'po.png',      FALSE),
    ('2', 'Oversized T-Shirt',  650,  'shirt', 'ovwhite.jpg', TRUE),
    ('3', 'Purple Flared Jeans',950,  'jeans', 'fla.jfif',    FALSE),
    ('4', 'Drip Jeans',         950,  'jeans', 'dri.jfif',    FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED INITIAL INVENTORY
-- ============================================================
INSERT INTO inventory (product_id, size, color, quantity) VALUES
    -- Polo T-Shirt (no color)
    ('1','XS','',5), ('1','S','',10), ('1','M','',15), ('1','L','',12), ('1','XL','',8),
    -- Oversized T-Shirt (Black)
    ('2','XS','Black',5), ('2','S','Black',8), ('2','M','Black',0), ('2','L','Black',10), ('2','XL','Black',4),
    -- Oversized T-Shirt (White)
    ('2','XS','White',3), ('2','S','White',0), ('2','M','White',12), ('2','L','White',7), ('2','XL','White',6),
    -- Purple Flared Jeans (no color)
    ('3','30','',5), ('3','32','',8), ('3','34','',10), ('3','36','',6), ('3','38','',4),
    -- Drip Jeans (no color)
    ('4','30','',3), ('4','32','',5), ('4','34','',0), ('4','36','',4), ('4','38','',2)
ON CONFLICT (product_id, size, color) DO NOTHING;

-- ============================================================
-- AFTER RUNNING THIS SCRIPT:
--
-- 1. Go to Authentication → Settings → Disable "Confirm email"
--    (so customers can log in immediately after signing up)
--
-- 2. Sign up with your admin email (ososseif2@gmail.com) via
--    the website's Sign Up form, then run this query to grant
--    admin access:
--
--    UPDATE profiles
--    SET is_admin = TRUE
--    WHERE id = (
--        SELECT id FROM auth.users WHERE email = 'ososseif2@gmail.com'
--    );
-- ============================================================
