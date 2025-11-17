-- ============================================
-- Migration: Create production_recap_gabah table
-- PT. Belitang Panen Raya
-- ============================================
-- This table stores production recap/summary data for GABAH (raw rice) per date period per location

-- ============================================
-- CREATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.production_recap_gabah (
    id BIGSERIAL PRIMARY KEY,
    m_location_id INTEGER NOT NULL REFERENCES public.master_locations(id),
    location TEXT NOT NULL,
    period_date DATE NOT NULL,
    jenisproduk TEXT NOT NULL,
    qty DECIMAL(10,2) NOT NULL DEFAULT 0, -- Can be negative
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_production_recap_gabah_m_location_id ON public.production_recap_gabah(m_location_id);
CREATE INDEX IF NOT EXISTS idx_production_recap_gabah_location ON public.production_recap_gabah(location);
CREATE INDEX IF NOT EXISTS idx_production_recap_gabah_period_date ON public.production_recap_gabah(period_date);
CREATE INDEX IF NOT EXISTS idx_production_recap_gabah_jenisproduk ON public.production_recap_gabah(jenisproduk);
CREATE INDEX IF NOT EXISTS idx_production_recap_gabah_location_date ON public.production_recap_gabah(m_location_id, period_date);
CREATE INDEX IF NOT EXISTS idx_production_recap_gabah_jenisproduk_date ON public.production_recap_gabah(jenisproduk, period_date);

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

CREATE TRIGGER update_production_recap_gabah_updated_at 
    BEFORE UPDATE ON public.production_recap_gabah
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.production_recap_gabah ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR production_recap_gabah TABLE
-- ============================================
-- Using existing get_current_user_role() function

-- Policy 1: SuperAdmin can view all production recap gabah data
CREATE POLICY "SuperAdmin can view all production recap gabah" 
    ON public.production_recap_gabah
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 2: BOD can view all production recap gabah data
CREATE POLICY "BOD can view all production recap gabah" 
    ON public.production_recap_gabah
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'BOD_ROLE'
    );

-- Policy 3: Sales Managers can only see production recap gabah from their assigned locations
CREATE POLICY "Sales Managers can view assigned location production recap gabah" 
    ON public.production_recap_gabah
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SALES_MANAGER_ROLE'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND production_recap_gabah.location = ANY(locations)
        )
        AND EXISTS (
            SELECT 1 FROM public.master_locations ml
            WHERE ml.id = production_recap_gabah.m_location_id
            AND ml.is_active = true
        )
    );

-- Policy 4: Sales Supervisors can only see production recap gabah from their assigned locations
CREATE POLICY "Sales Supervisors can view assigned location production recap gabah" 
    ON public.production_recap_gabah
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SALES_SUPERVISOR_ROLE'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND production_recap_gabah.location = ANY(locations)
        )
        AND EXISTS (
            SELECT 1 FROM public.master_locations ml
            WHERE ml.id = production_recap_gabah.m_location_id
            AND ml.is_active = true
        )
    );

-- Policy 5: Auditors can view all production recap gabah data
CREATE POLICY "Auditors can view all production recap gabah" 
    ON public.production_recap_gabah
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'AUDITOR_ROLE'
    );

-- Policy 6: SuperAdmin can insert production recap gabah data
CREATE POLICY "SuperAdmin can insert production recap gabah" 
    ON public.production_recap_gabah
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 7: SuperAdmin can update production recap gabah data
CREATE POLICY "SuperAdmin can update production recap gabah" 
    ON public.production_recap_gabah
    FOR UPDATE
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 8: SuperAdmin can delete production recap gabah data
CREATE POLICY "SuperAdmin can delete production recap gabah" 
    ON public.production_recap_gabah
    FOR DELETE
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant SELECT to authenticated users (filtered by RLS)
GRANT SELECT ON public.production_recap_gabah TO authenticated;

-- Grant all permissions to service_role (for admin operations and sync functions)
GRANT ALL ON public.production_recap_gabah TO service_role;

-- Grant usage on sequence for service_role
GRANT USAGE, SELECT ON SEQUENCE public.production_recap_gabah_id_seq TO service_role;

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.production_recap_gabah IS 'Production recap/summary data for GABAH (raw rice) per date period per location';
COMMENT ON COLUMN public.production_recap_gabah.m_location_id IS 'Foreign key reference to master_locations table';
COMMENT ON COLUMN public.production_recap_gabah.location IS 'Physical location name (denormalized from master_locations.name for performance)';
COMMENT ON COLUMN public.production_recap_gabah.period_date IS 'Date period for production recap';
COMMENT ON COLUMN public.production_recap_gabah.jenisproduk IS 'Product type/category (jenis produk) - GABAH related';
COMMENT ON COLUMN public.production_recap_gabah.qty IS 'Production quantity (can be negative for adjustments/returns)';
COMMENT ON COLUMN public.production_recap_gabah.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN public.production_recap_gabah.updated_at IS 'Record last update timestamp';

COMMENT ON POLICY "SuperAdmin can view all production recap gabah" ON public.production_recap_gabah IS 'SuperAdmin role has full visibility of all production recap gabah data';
COMMENT ON POLICY "Sales Managers can view assigned location production recap gabah" ON public.production_recap_gabah IS 'Sales Managers can only view production recap gabah from their assigned locations';
COMMENT ON POLICY "Sales Supervisors can view assigned location production recap gabah" ON public.production_recap_gabah IS 'Sales Supervisors can only view production recap gabah from their assigned locations';

-- ============================================
-- CREATE VIEW FOR EASIER QUERYING
-- ============================================

CREATE OR REPLACE VIEW production_recap_gabah_with_location AS
SELECT
    prg.*,
    ml.name as location_name,
    ml.is_active as location_is_active
FROM public.production_recap_gabah prg
JOIN public.master_locations ml ON ml.id = prg.m_location_id;

-- Grant SELECT on view
GRANT SELECT ON public.production_recap_gabah_with_location TO authenticated;
GRANT SELECT ON public.production_recap_gabah_with_location TO service_role;

COMMENT ON VIEW public.production_recap_gabah_with_location IS 'Production recap gabah with location details joined for easier querying';

-- ============================================
-- CREATE AGGREGATION VIEW BY MONTH
-- ============================================

CREATE OR REPLACE VIEW production_recap_gabah_monthly AS
SELECT
    m_location_id,
    location,
    DATE_TRUNC('month', period_date) as month,
    jenisproduk,
    SUM(qty) as total_qty,
    COUNT(*) as record_count,
    AVG(qty) as avg_qty,
    MIN(qty) as min_qty,
    MAX(qty) as max_qty
FROM public.production_recap_gabah
GROUP BY m_location_id, location, DATE_TRUNC('month', period_date), jenisproduk;

-- Grant SELECT on view
GRANT SELECT ON public.production_recap_gabah_monthly TO authenticated;
GRANT SELECT ON public.production_recap_gabah_monthly TO service_role;

COMMENT ON VIEW public.production_recap_gabah_monthly IS 'Monthly aggregation of production recap gabah data';

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
-- Run: SELECT * FROM production_recap_gabah;
-- Run: \d production_recap_gabah; (to see table structure)
--
-- To verify RLS is working:
-- Login as different roles and query:
-- SELECT * FROM production_recap_gabah; 
-- (Should only return production recap gabah for your assigned locations, or all if SUPERADMIN/BOD/AUDITOR)
--
-- RLS Policy Summary:
-- - SUPERADMIN_ROLE: Full access (SELECT, INSERT, UPDATE, DELETE)
-- - BOD_ROLE: View all production recap gabah data
-- - AUDITOR_ROLE: View all production recap gabah data
-- - SALES_MANAGER_ROLE: View only assigned locations
-- - SALES_SUPERVISOR_ROLE: View only assigned locations
--
-- Key Features:
-- - qty column can be negative for adjustments/returns
-- - Indexes on location_id, period_date, jenisproduk for optimal query performance
-- - Composite indexes for common query patterns (location+date, product+date)
-- - View with location details for easier querying
-- - Monthly aggregation view for reporting
-- - Follows same RLS pattern as other tables (stock, sales_summary, production_data, production_recap)
-- - Specifically designed for GABAH (raw rice) production tracking
