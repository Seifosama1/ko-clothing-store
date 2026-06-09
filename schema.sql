-- KO Clothing Store - Supabase Database Schema Setup
-- Paste this script into your Supabase Dashboard SQL Editor to initialize the database tables.

-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    type TEXT NOT NULL,
    img TEXT NOT NULL,
    discount_price NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create Policies for Products
CREATE POLICY "Allow public read access to products" ON public.products
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated owner to manage products" ON public.products
    FOR ALL TO authenticated USING (auth.jwt()->>'email' = 'ososseif2@gmail.com');


-- 2. Create Inventory Table
CREATE TABLE IF NOT EXISTS public.inventory (
    variant_key TEXT PRIMARY KEY, -- format: "productID_size" or "productID_size_color"
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create Policies for Inventory
CREATE POLICY "Allow public read access to inventory" ON public.inventory
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow public update to deduct inventory during order" ON public.inventory
    FOR UPDATE TO public USING (true);

CREATE POLICY "Allow authenticated owner to manage inventory" ON public.inventory
    FOR ALL TO authenticated USING (auth.jwt()->>'email' = 'ososseif2@gmail.com');


-- 3. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY, -- format: "#KO-12345"
    total_revenue NUMERIC NOT NULL,
    items_count INTEGER NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    shipping_address TEXT,
    city TEXT,
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create Policies for Orders
CREATE POLICY "Allow public to place orders" ON public.orders
    FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow authenticated owner to read and manage orders" ON public.orders
    FOR ALL TO authenticated USING (auth.jwt()->>'email' = 'ososseif2@gmail.com');


-- 4. Create Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    size TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT ''
);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create Policies for Order Items
CREATE POLICY "Allow public to insert order items" ON public.order_items
    FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow authenticated owner to read order items" ON public.order_items
    FOR ALL TO authenticated USING (auth.jwt()->>'email' = 'ososseif2@gmail.com');


-- 5. Seed Initial Products Data
INSERT INTO public.products (id, name, price, type, img)
VALUES 
  ('1', 'Polo T-Shirt', 650, 'shirt', 'po.png'),
  ('2', 'Oversized T-Shirt', 650, 'shirt', 'ovwhite.jpg'),
  ('3', 'Purple Flared Jeans', 950, 'jeans', 'fla.jfif'),
  ('4', 'Drip Jeans', 950, 'jeans', 'dri.jfif')
ON CONFLICT (id) DO NOTHING;


-- 6. Seed Initial Variant Inventory Stock Data
INSERT INTO public.inventory (variant_key, quantity)
VALUES
  ('1_XS', 5), ('1_S', 10), ('1_M', 15), ('1_L', 12), ('1_XL', 8),
  ('2_XS_Black', 5), ('2_S_Black', 8), ('2_M_Black', 0), ('2_L_Black', 10), ('2_XL_Black', 4),
  ('2_XS_White', 3), ('2_S_White', 0), ('2_M_White', 12), ('2_L_White', 7), ('2_XL_White', 6),
  ('3_30', 5), ('3_32', 8), ('3_34', 10), ('3_36', 6), ('3_38', 4),
  ('4_30', 3), ('4_32', 5), ('4_34', 0), ('4_36', 4), ('4_38', 2)
ON CONFLICT (variant_key) DO NOTHING;
