-- Migration: Create stock table for PT. Belitang Panen Raya
-- This table stores inventory data for rice products across different locations

-- Create the stock table with all required columns
-- Location column references master_locations table
CREATE TABLE IF NOT EXISTS public.stock (
    id BIGSERIAL PRIMARY KEY,
    m_location_id INTEGER NOT NULL REFERENCES public.master_locations(id),
    location TEXT NOT NULL, -- Denormalized for performance, should match master_locations.name
    m_product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    c_uom_id INTEGER NOT NULL,
    uom_name TEXT NOT NULL,
    m_product_category_id INTEGER NOT NULL,
    product_category_name TEXT NOT NULL,
    weight DECIMAL(10,2) NOT NULL DEFAULT 0,
    sumqtyonhand DECIMAL(10,2) NOT NULL DEFAULT 0,
    product_type TEXT NOT NULL DEFAULT 'rice',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_location ON public.stock(location);
CREATE INDEX IF NOT EXISTS idx_stock_m_location_id ON public.stock(m_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON public.stock(m_product_id);
CREATE INDEX IF NOT EXISTS idx_stock_category ON public.stock(m_product_category_id);
CREATE INDEX IF NOT EXISTS idx_stock_type ON public.stock(product_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON public.stock
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock table using existing get_current_user_role() function
-- SuperAdmin can see all stock data
CREATE POLICY "SuperAdmin can view all stock" ON public.stock
    FOR SELECT USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- BOD can view all stock data
CREATE POLICY "BOD can view all stock" ON public.stock
    FOR SELECT USING (
        get_current_user_role() = 'BOD_ROLE'
    );

-- Sales Managers can only see stock from their assigned locations
CREATE POLICY "Sales Managers can view assigned location stock" ON public.stock
    FOR SELECT USING (
        get_current_user_role() = 'SALES_MANAGER_ROLE'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND stock.location = ANY(locations)
        )
        AND EXISTS (
            SELECT 1 FROM public.master_locations ml
            WHERE ml.id = stock.m_location_id
            AND ml.is_active = true
        )
    );

-- Sales Supervisors can only see stock from their assigned locations
CREATE POLICY "Sales Supervisors can view assigned location stock" ON public.stock
    FOR SELECT USING (
        get_current_user_role() = 'SALES_SUPERVISOR_ROLE'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND stock.location = ANY(locations)
        )
        AND EXISTS (
            SELECT 1 FROM public.master_locations ml
            WHERE ml.id = stock.m_location_id
            AND ml.is_active = true
        )
    );

-- Auditors can view all stock data
CREATE POLICY "Auditors can view all stock" ON public.stock
    FOR SELECT USING (
        get_current_user_role() = 'AUDITOR_ROLE'
    );

-- Allow SuperAdmin to insert/update/delete stock data
CREATE POLICY "SuperAdmin can manage stock" ON public.stock
    FOR ALL USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Insert sample data for testing
-- Using subqueries to get the correct m_location_id from master_locations table
INSERT INTO public.stock (m_location_id, location, m_product_id, name, c_uom_id, uom_name, m_product_category_id, product_category_name, weight, sumqtyonhand, product_type)
SELECT
    ml.id,
    ml.name,
    stock_data.m_product_id,
    stock_data.name,
    stock_data.c_uom_id,
    stock_data.uom_name,
    stock_data.m_product_category_id,
    stock_data.product_category_name,
    stock_data.weight,
    stock_data.sumqtyonhand,
    stock_data.product_type
FROM (
    VALUES
    ('Jakarta', 'RICE-001', 'Beras Premium IR64', 1, 'ton', 1, 'Beras Premium', 1.00, 1250.50, 'rice'),
    ('Jakarta', 'RICE-002', 'Beras Medium IR42', 1, 'ton', 2, 'Beras Medium', 1.00, 890.25, 'rice'),
    ('Jakarta', 'RICE-003', 'Beras Organik', 1, 'ton', 3, 'Beras Organik', 1.00, 450.75, 'rice'),
    ('Surabaya', 'RICE-004', 'Beras Mentah - Surabaya', 1, 'ton', 4, 'Bahan Baku', 1.00, 2100.00, 'rice'),
    ('Surabaya', 'RICE-005', 'Beras Premium - Surabaya', 1, 'ton', 1, 'Beras Premium', 1.00, 675.30, 'rice'),
    ('Surabaya', 'RICE-006', 'Beras Standar - Surabaya', 1, 'ton', 5, 'Beras Standar', 1.00, 320.80, 'rice'),
    ('Bandung', 'RICE-007', 'Beras Organik - Bandung', 1, 'ton', 3, 'Beras Organik', 1.00, 180.45, 'rice'),
    ('Bandung', 'RICE-008', 'Beras Premium - Bandung', 1, 'ton', 1, 'Beras Premium', 1.00, 520.60, 'rice'),
    ('Medan', 'RICE-009', 'Beras Mentah - Medan', 1, 'ton', 4, 'Bahan Baku', 1.00, 950.20, 'rice'),
    ('Medan', 'RICE-010', 'Beras Premium - Medan', 1, 'ton', 1, 'Beras Premium', 1.00, 380.90, 'rice'),
    ('Yogyakarta', 'RICE-011', 'Beras Standar - Yogya', 1, 'ton', 5, 'Beras Standar', 1.00, 290.15, 'rice'),
    ('Yogyakarta', 'RICE-012', 'Beras Organik - Yogya', 1, 'ton', 3, 'Beras Organik', 1.00, 145.35, 'rice')
) AS stock_data(location, m_product_id, name, c_uom_id, uom_name, m_product_category_id, product_category_name, weight, sumqtyonhand, product_type)
JOIN public.master_locations ml ON ml.name = stock_data.location AND ml.is_active = true

ON CONFLICT DO NOTHING;

-- Create a view for easier querying with location-based filtering
CREATE OR REPLACE VIEW stock_with_location_filter AS
SELECT
    s.*
FROM public.stock s;

-- Grant necessary permissions
GRANT SELECT ON public.stock TO authenticated;
GRANT SELECT ON public.stock_with_location_filter TO authenticated;
GRANT ALL ON public.stock TO service_role;

COMMENT ON TABLE public.stock IS 'Main inventory table for rice products across all locations';
COMMENT ON COLUMN public.stock.m_location_id IS 'Foreign key reference to master_locations table';
COMMENT ON COLUMN public.stock.location IS 'Physical location name (denormalized from master_locations.name for performance)';
COMMENT ON COLUMN public.stock.m_product_id IS 'Product identifier code';
COMMENT ON COLUMN public.stock.name IS 'Product name/description';
COMMENT ON COLUMN public.stock.c_uom_id IS 'Unit of measure identifier';
COMMENT ON COLUMN public.stock.uom_name IS 'Unit of measure name (kg, ton, etc.)';
COMMENT ON COLUMN public.stock.m_product_category_id IS 'Product category identifier';
COMMENT ON COLUMN public.stock.product_category_name IS 'Product category name';
COMMENT ON COLUMN public.stock.weight IS 'Weight per unit in the specified UOM';
COMMENT ON COLUMN public.stock.sumqtyonhand IS 'Current quantity on hand';
COMMENT ON COLUMN public.stock.product_type IS 'Type of product (rice, etc.)';