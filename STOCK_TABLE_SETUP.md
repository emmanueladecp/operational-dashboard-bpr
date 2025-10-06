# Stock Table Setup Guide

## Overview

This guide explains how to set up the stock table in Supabase for the Internal Operation System. The stock table includes all required columns and proper Row Level Security policies.

## Updated Table Structure

The stock table now properly references the `master_locations` table:

**New Structure:**
- `m_location_id` - **Foreign key** to `master_locations(id)`
- `location` - **Denormalized** location name (from `master_locations.name`)
- `m_product_id` - Product identifier code
- `name` - Product name/description
- `c_uom_id` - Unit of measure identifier
- `uom_name` - Unit of measure name (kg, ton, etc.)
- `m_product_category_id` - Product category identifier
- `product_category_name` - Product category name
- `weight` - Weight per unit in the specified UOM
- `sumqtyonhand` - Current quantity on hand
- `product_type` - Type of product (rice, etc.)

*Note: The `status` column was removed per your request to keep the table focused on essential data.*

## Step 1: Apply the Database Migration

**Prerequisites:** Ensure your `master_locations` table exists and contains the locations you want to use.

Run the SQL migration file in your Supabase SQL editor:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase_stock_table_migration.sql`
4. Click **Run** to execute the migration

This will:
- ✅ Create the `stock` table with foreign key to `master_locations`
- ✅ Set up proper indexes for performance
- ✅ Configure Row Level Security policies using existing `get_current_user_role()` function
- ✅ Insert sample data using existing locations from `master_locations`
- ✅ Create a helpful view for easier querying

## Step 2: Verify the Setup

After running the migration, verify the table was created correctly:

```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'stock';

-- View sample data
SELECT * FROM public.stock LIMIT 5;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'stock';
```

## Step 3: Test Role-Based Access

The system implements role-based access control:

### SuperAdmin / BOD / Auditor
Can view all stock data across all locations.

### Sales Manager / Sales Supervisor
Can only view stock data for their assigned locations.

Test this by:

1. **Create a test user** with `SALES_MANAGER_ROLE`
2. **Assign specific locations** (e.g., only "Jakarta")
3. **Login as that user** and verify they only see Jakarta stock data

## Step 4: Dashboard Integration

The dashboard automatically:
- ✅ Fetches real stock data from Supabase
- ✅ Applies location-based filtering for sales roles
- ✅ Displays loading states while fetching data
- ✅ Shows appropriate messages when no data is available
- ✅ Updates total stock calculations dynamically

## Sample Data Included

The migration includes 12 sample records across 5 locations:

- **Jakarta**: 3 products (Premium rice, Medium rice, Organic rice)
- **Surabaya**: 3 products (Raw rice, Premium rice, Standard rice)
- **Bandung**: 2 products (Organic rice, Premium rice)
- **Medan**: 2 products (Raw rice, Premium rice)
- **Yogyakarta**: 2 products (Standard rice, Organic rice)

## Troubleshooting

### Common Issues

**Problem**: Stock data not loading in dashboard
```
Solution: Check browser console for errors and verify:
1. Supabase connection is working
2. User is authenticated
3. RLS policies allow access for the user's role
```

**Problem**: Sales roles see all locations instead of filtered data
```
Solution: Verify the user has locations assigned in the users table:
SELECT locations FROM users WHERE clerk_id = 'current_user_id';
```

**Problem**: Permission denied errors
```
Solution: Check RLS policies are enabled and user role is correct:
SELECT role FROM users WHERE clerk_id = auth.jwt() ->> 'sub';
```

**Problem**: `ERROR: 42809: op ANY/ALL (array) requires array on right side`
```
Solution: This indicates incorrect syntax in RLS policies. The ANY operator should be:
stock.location = ANY(users.locations) not location = ANY(stock.location)
```

**Problem**: `ERROR: 42883: operator does not exist: text = text[]`
```
Solution: This occurs when comparing text to text array incorrectly. Use EXISTS clause:
EXISTS (SELECT 1 FROM users WHERE clerk_id = auth.jwt() ->> 'sub' AND stock.location = ANY(locations))
```

**Problem**: `ERROR: insert or update on table "stock" violates foreign key constraint`
```
Solution: This means the location names in sample data don't exist in master_locations table.
Check your master_locations table: SELECT * FROM master_locations WHERE is_active = true;
Update the sample data location names to match your existing locations.
```

**Problem**: No stock data appears after migration
```
Solution: Verify that:
1. master_locations table has active locations
2. Sample data location names match master_locations.name exactly
3. User has proper role and location assignments
```

## Next Steps

Once the stock table is working:

1. **Add more sample data** for realistic testing
2. **Create stock management interface** for SuperAdmin users
3. **Set up real-time subscriptions** for live updates
4. **Add stock movement tracking** (in/out transactions)
5. **Implement low stock alerts** and notifications

## File Structure

```
supabase_stock_table_migration.sql  # Complete migration with table, policies, and data
src/components/Dashboard.tsx        # Updated to use real stock data
STOCK_TABLE_SETUP.md               # This documentation
```

## Support

The stock table is now fully integrated with:
- ✅ Role-based access control
- ✅ Location-based data filtering
- ✅ Real-time data fetching
- ✅ Proper error handling
- ✅ Loading states and user feedback

Your operational dashboard now uses real data from Supabase instead of mock data!