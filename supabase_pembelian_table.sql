-- ============================================
-- Migration: Create pembelian (purchases) table
-- PT. Belitang Panen Raya
-- ============================================
-- This table stores purchase/procurement data per date period per location

-- ============================================
-- CREATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.pembelian (
    id BIGSERIAL PRIMARY KEY,
    m_location_id INTEGER NOT NULL REFERENCES public.master_locations(id),
    location TEXT NOT NULL,
    periode_date DATE NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    movementqty DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    priceharian DECIMAL(15,2) NOT NULL DEFAULT 0,
    category_id INTEGER,
    category_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pembelian_m_location_id ON public.pembelian(m_location_id);
CREATE INDEX IF NOT EXISTS idx_pembelian_location ON public.pembelian(location);
CREATE INDEX IF NOT EXISTS idx_pembelian_periode_date ON public.pembelian(periode_date);
CREATE INDEX IF NOT EXISTS idx_pembelian_product_id ON public.pembelian(product_id);
CREATE INDEX IF NOT EXISTS idx_pembelian_product_name ON public.pembelian(product_name);
CREATE INDEX IF NOT EXISTS idx_pembelian_category_id ON public.pembelian(category_id);
CREATE INDEX IF NOT EXISTS idx_pembelian_location_date ON public.pembelian(m_location_id, periode_date);
CREATE INDEX IF NOT EXISTS idx_pembelian_product_date ON public.pembelian(product_id, periode_date);
CREATE INDEX IF NOT EXISTS idx_pembelian_category_date ON public.pembelian(category_id, periode_date);

-- ============================================
-- CREATE UPDATED_AT TRIGGER
-- ============================================

-- Reuse existing trigger function if available, or create if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pembelian_updated_at 
    BEFORE UPDATE ON public.pembelian
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.pembelian ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE HELPER FUNCTION FOR USER ROLE
-- ============================================

-- Create helper function to get current user role from JWT (if not exists)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM public.users
        WHERE clerk_id = auth.jwt() ->> 'sub'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES FOR pembelian TABLE
-- ============================================
-- Using get_current_user_role() function

-- Policy 1: SuperAdmin can view all pembelian data
CREATE POLICY "SuperAdmin can view all pembelian" 
    ON public.pembelian
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 2: BOD can view all pembelian data
CREATE POLICY "BOD can view all pembelian" 
    ON public.pembelian
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'BOD_ROLE'
    );

-- Policy 3: Sales Managers can only see pembelian from their assigned locations
CREATE POLICY "Sales Managers can view assigned location pembelian" 
    ON public.pembelian
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SALES_MANAGER_ROLE'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND pembelian.location = ANY(locations)
        )
        AND EXISTS (
            SELECT 1 FROM public.master_locations ml
            WHERE ml.id = pembelian.m_location_id
            AND ml.is_active = true
        )
    );

-- Policy 4: Sales Supervisors can only see pembelian from their assigned locations
CREATE POLICY "Sales Supervisors can view assigned location pembelian" 
    ON public.pembelian
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SALES_SUPERVISOR_ROLE'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND pembelian.location = ANY(locations)
        )
        AND EXISTS (
            SELECT 1 FROM public.master_locations ml
            WHERE ml.id = pembelian.m_location_id
            AND ml.is_active = true
        )
    );

-- Policy 5: Auditors can view all pembelian data
CREATE POLICY "Auditors can view all pembelian" 
    ON public.pembelian
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'AUDITOR_ROLE'
    );

-- Policy 6: SuperAdmin can insert pembelian data
CREATE POLICY "SuperAdmin can insert pembelian" 
    ON public.pembelian
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 7: SuperAdmin can update pembelian data
CREATE POLICY "SuperAdmin can update pembelian" 
    ON public.pembelian
    FOR UPDATE
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 8: SuperAdmin can delete pembelian data
CREATE POLICY "SuperAdmin can delete pembelian" 
    ON public.pembelian
    FOR DELETE
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant SELECT to authenticated users (filtered by RLS)
GRANT SELECT ON public.pembelian TO authenticated;

-- Grant all permissions to service_role (for admin operations and sync functions)
GRANT ALL ON public.pembelian TO service_role;

-- Grant usage on sequence for service_role
GRANT USAGE, SELECT ON SEQUENCE public.pembelian_id_seq TO service_role;

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.pembelian IS 'Purchase/procurement data per date period per location';
COMMENT ON COLUMN public.pembelian.id IS 'Auto-incrementing primary key';
COMMENT ON COLUMN public.pembelian.m_location_id IS 'Foreign key reference to master_locations table';
COMMENT ON COLUMN public.pembelian.location IS 'Physical location name (denormalized from master_locations.name for performance)';
COMMENT ON COLUMN public.pembelian.periode_date IS 'Date period for purchase transaction (YYYY-MM-DD format)';
COMMENT ON COLUMN public.pembelian.product_id IS 'Product identifier from external ERP system';
COMMENT ON COLUMN public.pembelian.product_name IS 'Product name/description';
COMMENT ON COLUMN public.pembelian.movementqty IS 'Movement quantity (positive for purchases, can be negative for returns)';
COMMENT ON COLUMN public.pembelian.subtotal IS 'Subtotal amount for this purchase line (movementqty * priceharian)';
COMMENT ON COLUMN public.pembelian.priceharian IS 'Daily price/unit price for the product';
COMMENT ON COLUMN public.pembelian.category_id IS 'Product category identifier';
COMMENT ON COLUMN public.pembelian.category_name IS 'Product category name/description';
COMMENT ON COLUMN public.pembelian.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN public.pembelian.updated_at IS 'Record last update timestamp';

COMMENT ON POLICY "SuperAdmin can view all pembelian" ON public.pembelian IS 'SuperAdmin role has full visibility of all purchase data';
COMMENT ON POLICY "BOD can view all pembelian" ON public.pembelian IS 'BOD role can view all purchase data across all locations';
COMMENT ON POLICY "Sales Managers can view assigned location pembelian" ON public.pembelian IS 'Sales Managers can only view purchase data from their assigned locations';
COMMENT ON POLICY "Sales Supervisors can view assigned location pembelian" ON public.pembelian IS 'Sales Supervisors can only view purchase data from their assigned locations';
COMMENT ON POLICY "Auditors can view all pembelian" ON public.pembelian IS 'Auditor role can view all purchase data for audit purposes';

-- ============================================
-- CREATE VIEW FOR EASIER QUERYING
-- ============================================

CREATE OR REPLACE VIEW pembelian_with_location AS
SELECT
    p.*,
    ml.name as location_name,
    ml.is_active as location_is_active
FROM public.pembelian p
JOIN public.master_locations ml ON ml.id = p.m_location_id;

-- Grant SELECT on view
GRANT SELECT ON public.pembelian_with_location TO authenticated;
GRANT SELECT ON public.pembelian_with_location TO service_role;

COMMENT ON VIEW public.pembelian_with_location IS 'Pembelian (purchases) with location details joined for easier querying';

-- ============================================
-- CREATE AGGREGATION VIEW BY PRODUCT
-- ============================================

CREATE OR REPLACE VIEW pembelian_by_product AS
SELECT
    m_location_id,
    location,
    product_id,
    product_name,
    category_id,
    category_name,
    DATE_TRUNC('month', periode_date) as month,
    SUM(movementqty) as total_qty,
    SUM(subtotal) as total_subtotal,
    AVG(priceharian) as avg_price,
    COUNT(*) as transaction_count,
    MIN(priceharian) as min_price,
    MAX(priceharian) as max_price
FROM public.pembelian
GROUP BY m_location_id, location, product_id, product_name, category_id, category_name, DATE_TRUNC('month', periode_date);

-- Grant SELECT on view
GRANT SELECT ON public.pembelian_by_product TO authenticated;
GRANT SELECT ON public.pembelian_by_product TO service_role;

COMMENT ON VIEW public.pembelian_by_product IS 'Monthly aggregation of purchase data by product';

-- ============================================
-- CREATE AGGREGATION VIEW BY CATEGORY
-- ============================================

CREATE OR REPLACE VIEW pembelian_by_category AS
SELECT
    m_location_id,
    location,
    category_id,
    category_name,
    DATE_TRUNC('month', periode_date) as month,
    SUM(movementqty) as total_qty,
    SUM(subtotal) as total_subtotal,
    COUNT(DISTINCT product_id) as product_count,
    COUNT(*) as transaction_count
FROM public.pembelian
WHERE category_id IS NOT NULL
GROUP BY m_location_id, location, category_id, category_name, DATE_TRUNC('month', periode_date);

-- Grant SELECT on view
GRANT SELECT ON public.pembelian_by_category TO authenticated;
GRANT SELECT ON public.pembelian_by_category TO service_role;

COMMENT ON VIEW public.pembelian_by_category IS 'Monthly aggregation of purchase data by category';

-- ============================================
-- CREATE AGGREGATION VIEW BY LOCATION
-- ============================================

CREATE OR REPLACE VIEW pembelian_by_location AS
SELECT
    m_location_id,
    location,
    DATE_TRUNC('month', periode_date) as month,
    SUM(movementqty) as total_qty,
    SUM(subtotal) as total_subtotal,
    COUNT(DISTINCT product_id) as product_count,
    COUNT(DISTINCT category_id) as category_count,
    COUNT(*) as transaction_count,
    AVG(priceharian) as avg_price
FROM public.pembelian
GROUP BY m_location_id, location, DATE_TRUNC('month', periode_date);

-- Grant SELECT on view
GRANT SELECT ON public.pembelian_by_location TO authenticated;
GRANT SELECT ON public.pembelian_by_location TO service_role;

COMMENT ON VIEW public.pembelian_by_location IS 'Monthly aggregation of purchase data by location';

-- ============================================
-- NOTES
-- ============================================
-- 
-- To apply this migration:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run" to execute
--
-- To verify table creation:
-- Run: SELECT * FROM pembelian LIMIT 10;
-- Run: \d pembelian; (to see table structure in psql)
--
-- To verify RLS is working:
-- Login as different roles and query:
-- SELECT * FROM pembelian; 
-- (Should only return purchase data for your assigned locations, or all if SUPERADMIN/BOD/AUDITOR)
--
-- RLS Policy Summary:
-- - SUPERADMIN_ROLE: Full access (SELECT, INSERT, UPDATE, DELETE)
-- - BOD_ROLE: View all purchase data
-- - AUDITOR_ROLE: View all purchase data
-- - SALES_MANAGER_ROLE: View only assigned locations
-- - SALES_SUPERVISOR_ROLE: View only assigned locations
--
-- Key Features:
-- - movementqty can be negative for returns/adjustments
-- - subtotal stores the calculated amount (qty * price)
-- - priceharian stores the unit price for audit trail
-- - Indexes on location_id, periode_date, product_id, category_id for optimal performance
-- - Composite indexes for common query patterns (location+date, product+date, category+date)
-- - Three aggregation views for reporting:
--   * pembelian_by_product: Monthly aggregation by product
--   * pembelian_by_category: Monthly aggregation by category
--   * pembelian_by_location: Monthly aggregation by location
-- - Follows same RLS pattern as other tables (stock, sales_summary, production_recap)
--
-- Sample Data Insert (for testing):
-- INSERT INTO pembelian (m_location_id, location, periode_date, product_id, product_name, movementqty, subtotal, priceharian, category_id, category_name)
-- VALUES (1, 'Kantor Pusat', '2025-01-15', 'P001', 'Gabah Basah', 1000.00, 5000000.00, 5000.00, 1, 'Raw Material');
--
-- Sample Query Examples:
-- -- Get all purchases for a specific location
-- SELECT * FROM pembelian WHERE m_location_id = 1 ORDER BY periode_date DESC;
--
-- -- Get monthly purchase summary by location
-- SELECT * FROM pembelian_by_location WHERE month = '2025-01-01';
--
-- -- Get top purchased products
-- SELECT product_name, SUM(movementqty) as total_qty, SUM(subtotal) as total_amount
-- FROM pembelian
-- WHERE periode_date >= '2025-01-01' AND periode_date < '2025-02-01'
-- GROUP BY product_name
-- ORDER BY total_amount DESC
-- LIMIT 10;
