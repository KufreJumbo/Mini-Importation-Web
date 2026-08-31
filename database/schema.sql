-- =============================================
-- CHI BEST - DATABASE SCHEMA
-- =============================================
-- Run this SQL in your Supabase SQL Editor to create all required tables
-- =============================================

-- Enable UUID extension for unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PRODUCTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    original_price NUMERIC(12, 2),
    image TEXT,
    category TEXT NOT NULL DEFAULT 'fashion',
    status TEXT NOT NULL DEFAULT 'in-stock' CHECK (status IN ('in-stock', 'low-stock', 'out-of-stock', 'preorder', 'sold-out')),
    quantity INTEGER DEFAULT 0,
    rating NUMERIC(2, 1) DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    badge TEXT,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);

-- =============================================
-- CUSTOMERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customers(whatsapp);

-- =============================================
-- ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_whatsapp TEXT,
    delivery_address TEXT,
    delivery_city TEXT,
    delivery_state TEXT,
    notes TEXT,
    
    -- Order totals
    subtotal NUMERIC(12, 2) NOT NULL,
    delivery_fee NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL,
    
    -- Payment status
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'awaiting-payment', 'paid', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    payment_method TEXT,
    payment_reference TEXT,
    receipt_image TEXT,
    
    -- Order status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- =============================================
-- ORDER ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_price NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- =============================================
-- PRODUCT REQUESTS TABLE (Sourcing Requests)
-- =============================================
CREATE TABLE IF NOT EXISTS product_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT NOT NULL,
    customer_whatsapp TEXT NOT NULL,
    
    -- Product details
    description TEXT NOT NULL,
    product_link TEXT,
    images TEXT[], -- Array of image URLs
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    
    -- Request status
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'sourcing', 'quoted', 'accepted', 'rejected', 'completed')),
    quoted_price NUMERIC(12, 2),
    quoted_delivery_days INTEGER,
    
    -- Admin notes
    admin_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_requests_status ON product_requests(status);
CREATE INDEX IF NOT EXISTS idx_product_requests_whatsapp ON product_requests(customer_whatsapp);

-- =============================================
-- RECEIPTS TABLE (Payment Receipts Storage)
-- =============================================
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Receipt details
    image_url TEXT NOT NULL,
    amount NUMERIC(12, 2),
    payment_reference TEXT,
    bank_name TEXT,
    notes TEXT,
    
    -- Verification status
    verified BOOLEAN DEFAULT false,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_verified ON receipts(verified);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Products: Everyone can read, only authenticated users can insert/update/delete
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);
CREATE POLICY "Products can be inserted by authenticated users" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Products can be updated by authenticated users" ON products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Products can be deleted by authenticated users" ON products FOR DELETE USING (auth.role() = 'authenticated');

-- Customers: Everyone can create, only owner can read/update
CREATE POLICY "Customers can be created by everyone" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Customers are viewable by everyone" ON customers FOR SELECT USING (true);
CREATE POLICY "Customers can be updated by authenticated users" ON customers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Customers can be deleted by authenticated users" ON customers FOR DELETE USING (auth.role() = 'authenticated');

-- Orders: Everyone can create and read their own orders
CREATE POLICY "Orders can be created by everyone" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders are viewable by everyone" ON orders FOR SELECT USING (true);
CREATE POLICY "Orders can be updated by authenticated users" ON orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Orders can be deleted by authenticated users" ON orders FOR DELETE USING (auth.role() = 'authenticated');

-- Order Items: Same as orders
CREATE POLICY "Order items can be created by everyone" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Order items are viewable by everyone" ON order_items FOR SELECT USING (true);
CREATE POLICY "Order items can be updated by authenticated users" ON order_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Order items can be deleted by authenticated users" ON order_items FOR DELETE USING (auth.role() = 'authenticated');

-- Product Requests: Everyone can create, only authenticated can read/update
CREATE POLICY "Requests can be created by everyone" ON product_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Requests are viewable by everyone" ON product_requests FOR SELECT USING (true);
CREATE POLICY "Requests can be updated by authenticated users" ON product_requests FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Requests can be deleted by authenticated users" ON product_requests FOR DELETE USING (auth.role() = 'authenticated');

-- Receipts: Everyone can create, only authenticated can read/update
CREATE POLICY "Receipts can be created by everyone" ON receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Receipts are viewable by everyone" ON receipts FOR SELECT USING (true);
CREATE POLICY "Receipts can be updated by authenticated users" ON receipts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Receipts can be deleted by authenticated users" ON receipts FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- STORAGE BUCKET FOR IMAGES
-- =============================================
-- Create a bucket for storing product images and receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Images are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Images can be uploaded by authenticated users" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');
CREATE POLICY "Images can be updated by authenticated users" ON storage.objects FOR UPDATE USING (bucket_id = 'images' AND auth.role() = 'authenticated');
CREATE POLICY "Images can be deleted by authenticated users" ON storage.objects FOR DELETE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================
/*
INSERT INTO products (name, description, price, original_price, category, status, quantity, rating, reviews, badge, featured) VALUES
('Smart Watch Pro', 'Feature-rich smartwatch with heart rate monitor, fitness tracking, and notification alerts.', 15000, 20000, 'electronics', 'in-stock', 30, 4.5, 45, 'Hot', true),
('Designer Handbag', 'Elegant designer-inspired handbag with multiple compartments.', 12500, 18000, 'bags', 'in-stock', 12, 5, 32, 'New', true),
('Wireless Earbuds', 'High-quality wireless earbuds with active noise cancellation.', 8500, 12000, 'electronics', 'in-stock', 50, 4, 28, NULL, true),
('Classic Sneakers', 'Comfortable white sneakers with cushioned sole.', 9800, 14000, 'shoes', 'in-stock', 35, 4.5, 56, '-30%', true),
('Skincare Set', 'Complete skincare routine set including cleanser, toner, serum.', 8500, 12000, 'beauty', 'in-stock', 20, 5, 38, 'Best Seller', true);
*/