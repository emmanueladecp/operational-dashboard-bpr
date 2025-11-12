-- ============================================
-- Migration: Create production_data table
-- PT. Belitang Panen Raya
-- ============================================
-- This table stores production data (hasil produksi) across different locations

-- Create the production_data table with all required columns
CREATE TABLE IF NOT EXISTS public.production_data (
    id BIGSERIAL PRIMARY KEY,
    m_location_id INTEGER NOT NULL REFERENCES public.master_locations(id),
    location TEXT NOT NULL,
    m_production_id TEXT NOT NULL,
    documentno TEXT NOT NULL,
    c_doctype_id INTEGER NOT NULL,
    jenisproduk TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    movementqty DECIMAL(10,2) NOT NULL DEFAULT 0,
    movementdate TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_production_data_m_location_id ON public.production_data(m_location_id);
CREATE INDEX IF NOT EXISTS idx_production_data_location ON public.production_data(location);
CREATE INDEX IF NOT EXISTS idx_production_data_production_id ON public.production_data(m_production_id);
CREATE INDEX IF NOT EXISTS idx_production_data_product_id ON public.production_data(product_id);
CREATE INDEX IF NOT EXISTS idx_production_data_doctype ON public.production_data(c_doctype_id);
CREATE INDEX IF NOT EXISTS idx_production_data_jenisproduk ON public.production_data(jenisproduk);
CREATE INDEX IF NOT EXISTS idx_production_data_movementdate ON public.production_data(movementdate);
CREATE INDEX IF NOT EXISTS idx_production_data_documentno ON public.production_data(documentno);

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

CREATE TRIGGER update_production_data_updated_at 
    BEFORE UPDATE ON public.production_data
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.production_data ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR production_data TABLE
-- ============================================
-- Using existing get_current_user_role() function

-- Policy 1: SuperAdmin can view all production data
CREATE POLICY "SuperAdmin can view all production data" 
    ON public.production_data
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 2: BOD can view all production data
CREATE POLICY "BOD can view all production data" 
    ON public.production_data
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'BOD_ROLE'
    );

-- Policy 3: Sales Managers can only see production data from their assigned locations
CREATE POLICY "Sales Managers can view assigned location production" 
    ON public.production_data
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SALES_MANAGER_ROLE'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND production_data.location = ANY(locations)
        )
        AND EXISTS (
            SELECT 1 FROM public.master_locations ml
            WHERE ml.id = production_data.m_location_id
            AND ml.is_active = true
        )
    );

-- Policy 4: Sales Supervisors can only see production data from their assigned locations
CREATE POLICY "Sales Supervisors can view assigned location production" 
    ON public.production_data
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'SALES_SUPERVISOR_ROLE'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND production_data.location = ANY(locations)
        )
        AND EXISTS (
            SELECT 1 FROM public.master_locations ml
            WHERE ml.id = production_data.m_location_id
            AND ml.is_active = true
        )
    );

-- Policy 5: Auditors can view all production data
CREATE POLICY "Auditors can view all production data" 
    ON public.production_data
    FOR SELECT
    TO authenticated
    USING (
        get_current_user_role() = 'AUDITOR_ROLE'
    );

-- Policy 6: SuperAdmin can insert production data
CREATE POLICY "SuperAdmin can insert production data" 
    ON public.production_data
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 7: SuperAdmin can update production data
CREATE POLICY "SuperAdmin can update production data" 
    ON public.production_data
    FOR UPDATE
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- Policy 8: SuperAdmin can delete production data
CREATE POLICY "SuperAdmin can delete production data" 
    ON public.production_data
    FOR DELETE
    TO authenticated
    USING (
        get_current_user_role() = 'SUPERADMIN_ROLE'
    );

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant SELECT to authenticated users (filtered by RLS)
GRANT SELECT ON public.production_data TO authenticated;

-- Grant all permissions to service_role (for admin operations and sync functions)
GRANT ALL ON public.production_data TO service_role;

-- Grant usage on sequence for service_role
GRANT USAGE, SELECT ON SEQUENCE public.production_data_id_seq TO service_role;

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.production_data IS 'Production data (hasil produksi) across all locations';
COMMENT ON COLUMN public.production_data.m_location_id IS 'Foreign key reference to master_locations table';
COMMENT ON COLUMN public.production_data.location IS 'Physical location name (denormalized from master_locations.name for performance)';
COMMENT ON COLUMN public.production_data.m_production_id IS 'Production identifier from source system';
COMMENT ON COLUMN public.production_data.documentno IS 'Production document number';
COMMENT ON COLUMN public.production_data.c_doctype_id IS 'Document type identifier';
COMMENT ON COLUMN public.production_data.jenisproduk IS 'Product type/category (jenis produk)';
COMMENT ON COLUMN public.production_data.product_id IS 'Product identifier';
COMMENT ON COLUMN public.production_data.product_name IS 'Product name/description';
COMMENT ON COLUMN public.production_data.movementqty IS 'Production quantity/movement quantity';
COMMENT ON COLUMN public.production_data.movementdate IS 'Production date/movement date';
COMMENT ON COLUMN public.production_data.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN public.production_data.updated_at IS 'Record last update timestamp';

COMMENT ON POLICY "SuperAdmin can view all production data" ON public.production_data IS 'SuperAdmin role has full visibility of all production data';
COMMENT ON POLICY "Sales Managers can view assigned location production" ON public.production_data IS 'Sales Managers can only view production data from their assigned locations';
COMMENT ON POLICY "Sales Supervisors can view assigned location production" ON public.production_data IS 'Sales Supervisors can only view production data from their assigned locations';

-- ============================================
-- CREATE VIEW FOR EASIER QUERYING
-- ============================================

CREATE OR REPLACE VIEW production_data_with_location AS
SELECT
    pd.*,
    ml.name as location_name,
    ml.is_active as location_is_active
FROM public.production_data pd
JOIN public.master_locations ml ON ml.id = pd.m_location_id;

-- Grant SELECT on view
GRANT SELECT ON public.production_data_with_location TO authenticated;

COMMENT ON VIEW public.production_data_with_location IS 'Production data with location details joined for easier querying';

-- ============================================
-- NOTES
-- ============================================
-- 
-- To apply this migration:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run" to execute
--
-- To verify RLS is working:
-- Run: SELECT * FROM production_data; 
-- (Should only return production data for your assigned locations, or all if SUPERADMIN/BOD/AUDITOR)
--
-- RLS Policy Summary:
-- - SUPERADMIN_ROLE: Full access (SELECT, INSERT, UPDATE, DELETE)
-- - BOD_ROLE: View all production data
-- - AUDITOR_ROLE: View all production data
-- - SALES_MANAGER_ROLE: View only assigned locations
-- - SALES_SUPERVISOR_ROLE: View only assigned locations
