-- ============================================
-- Row Level Security (RLS) Policies
-- Operational Dashboard v1
-- Using Clerk Native Integration
-- ============================================

-- ============================================
-- USERS TABLE RLS POLICIES
-- ============================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own record
CREATE POLICY "Users can view own record"
ON users
FOR SELECT
TO authenticated
USING ((auth.jwt()->>'sub')::text = clerk_id);

-- Policy 2: SUPERADMIN can view all users
CREATE POLICY "SUPERADMIN can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = (auth.jwt()->>'sub')::text
    AND role = 'SUPERADMIN_ROLE'
  )
);

-- Policy 3: Users can update their own name (not role/locations)
CREATE POLICY "Users can update own name"
ON users
FOR UPDATE
TO authenticated
USING ((auth.jwt()->>'sub')::text = clerk_id)
WITH CHECK (
  (auth.jwt()->>'sub')::text = clerk_id
  AND role = (SELECT role FROM users WHERE clerk_id = (auth.jwt()->>'sub')::text)
  AND locations = (SELECT locations FROM users WHERE clerk_id = (auth.jwt()->>'sub')::text)
);

-- Policy 4: SUPERADMIN can update any user
CREATE POLICY "SUPERADMIN can update users"
ON users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = (auth.jwt()->>'sub')::text
    AND role = 'SUPERADMIN_ROLE'
  )
);

-- Policy 5: Allow user creation on first login (INSERT for new users)
CREATE POLICY "Allow user self-registration"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt()->>'sub')::text = clerk_id
  AND role = 'NO_ROLE'
);

-- Policy 6: SUPERADMIN can delete users
CREATE POLICY "SUPERADMIN can delete users"
ON users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = (auth.jwt()->>'sub')::text
    AND role = 'SUPERADMIN_ROLE'
  )
);

-- ============================================
-- MASTER_LOCATIONS TABLE RLS POLICIES
-- ============================================

-- Enable RLS on master_locations table
ALTER TABLE master_locations ENABLE ROW LEVEL SECURITY;

-- Policy 1: All authenticated users can view active locations
CREATE POLICY "All users can view active locations"
ON master_locations
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy 2: SUPERADMIN can view all locations (including inactive)
CREATE POLICY "SUPERADMIN can view all locations"
ON master_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = (auth.jwt()->>'sub')::text
    AND role = 'SUPERADMIN_ROLE'
  )
);

-- Policy 3: SUPERADMIN can insert locations
CREATE POLICY "SUPERADMIN can insert locations"
ON master_locations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = (auth.jwt()->>'sub')::text
    AND role = 'SUPERADMIN_ROLE'
  )
);

-- Policy 4: SUPERADMIN can update locations
CREATE POLICY "SUPERADMIN can update locations"
ON master_locations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = (auth.jwt()->>'sub')::text
    AND role = 'SUPERADMIN_ROLE'
  )
);

-- Policy 5: SUPERADMIN can delete locations
CREATE POLICY "SUPERADMIN can delete locations"
ON master_locations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = (auth.jwt()->>'sub')::text
    AND role = 'SUPERADMIN_ROLE'
  )
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index on clerk_id for faster user lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Index on role for faster permission checks
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Index on is_active for location filtering
CREATE INDEX IF NOT EXISTS idx_master_locations_active ON master_locations(is_active);

-- ============================================
-- NOTES
-- ============================================
-- 
-- Authentication Requirement:
-- - Using Clerk Native Supabase Integration (Third-Party Auth)
-- - Clerk user ID is accessed via auth.jwt()->>'sub'
-- - No need for JWT templates or manual token management
-- - Clerk automatically injects authenticated role into JWT
--
-- Prerequisites:
-- 1. Clerk Supabase integration must be enabled in Clerk Dashboard
-- 2. Clerk configured as third-party auth provider in Supabase
--
-- To apply these policies:
-- 1. Go to Supabase Dashboard
-- 2. Select your project
-- 3. Go to SQL Editor
-- 4. Paste this entire file
-- 5. Click "Run" to execute
--
-- To verify RLS is working:
-- Run: SELECT * FROM users; 
-- (Should only return your own user or all users if SUPERADMIN)
