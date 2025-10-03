# RLS Implementation Guide

## Overview
This guide explains how to implement Row Level Security (RLS) policies for your Supabase database using **Clerk's Native Supabase Integration**. This secures access to the `users` and `master_locations` tables at the database level.

## Prerequisites
- ✅ Supabase project with `users` and `master_locations` tables created
- ✅ Clerk authentication integrated in your app
- ✅ **Clerk Supabase Integration enabled** (https://clerk.com/docs/guides/development/integrations/databases/supabase)
- ⚠️ At least one SUPERADMIN user already exists in the database

## Step 1: Apply RLS Policies

### Option A: Using Supabase Dashboard (Recommended)
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `idniillfrvnppeerzxol`
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Open `supabase_rls_policies.sql` from your project root
6. Copy and paste the entire SQL content
7. Click **Run** or press `Ctrl + Enter`
8. Verify success - you should see "Success. No rows returned"

### Option B: Using Supabase CLI
```bash
supabase db push --file supabase_rls_policies.sql
```

## Step 2: Update Supabase Client to Use Clerk Integration

Replace your `src/lib/supabase.ts` with the following code that uses Clerk's session token:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create a function that returns a Supabase client with Clerk session token
export function createClerkSupabaseClient(getToken: () => Promise<string | null>) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    },
    auth: {
      async getSession() {
        const token = await getToken()
        return { data: { session: token ? { access_token: token } : null }, error: null }
      },
    },
  })
}

// For convenience, export a basic client (without auth - won't pass RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  }
})
```

## Step 3: Update Dashboard Component to Use Authenticated Client

Modify `src/components/Dashboard.tsx` to use the Clerk-authenticated Supabase client:

```typescript
import { useSession } from "@clerk/clerk-react";
import { createClerkSupabaseClient } from "../lib/supabase";

export default function Dashboard() {
  const { session } = useSession();
  
  // Create authenticated Supabase client
  const supabase = useMemo(() => {
    if (!session) return null;
    return createClerkSupabaseClient(() => session.getToken());
  }, [session]);

  // Now all your supabase queries will be authenticated
  // Example:
  const fetchData = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('users').select('*');
    // ...
  };
}
```

## Step 4: Verify RLS is Working

### Test as Regular User
```sql
-- Should only return your own user record
SELECT * FROM users;

-- Should return only active locations
SELECT * FROM master_locations WHERE is_active = true;
```

### Test as SUPERADMIN
```sql
-- Should return all users
SELECT * FROM users;

-- Should return all locations (including inactive)
SELECT * FROM master_locations;
```

### Test in Browser Console
```javascript
// After logging in
const { data, error } = await supabase.from('users').select('*');
console.log('Users:', data); // Regular user: 1 row, SUPERADMIN: all rows
```

## RLS Policies Summary

### Users Table Policies
- ✅ Users can view their own record
- ✅ SUPERADMIN can view all users
- ✅ Users can update their own name only
- ✅ SUPERADMIN can update any user (role, locations, etc.)
- ✅ New users can self-register with NO_ROLE
- ✅ SUPERADMIN can delete users

### Master Locations Table Policies
- ✅ All authenticated users can view active locations
- ✅ SUPERADMIN can view all locations (including inactive)
- ✅ SUPERADMIN can insert, update, delete locations

## Troubleshooting

### Issue: "new row violates row-level security policy"
**Cause:** Trying to insert/update data that violates RLS policies

**Solution:** 
- Verify user has correct role in the database
- Check Clerk session token is being passed correctly
- Ensure Clerk Supabase integration is active

### Issue: "SELECT returns 0 rows" when you expect data
**Cause:** RLS is blocking access

**Solution:**
- Verify `auth.jwt()->>'sub'` matches `users.clerk_id` in database
- Check user is properly authenticated (session exists)
- Verify RLS policies are applied: `SELECT * FROM pg_policies WHERE tablename IN ('users', 'master_locations');`
- Test auth token: `SELECT auth.jwt()->>'sub' FROM users LIMIT 1;`
- Temporarily disable RLS to test: `ALTER TABLE users DISABLE ROW LEVEL SECURITY;` (Remember to re-enable!)

### Issue: Cannot update user role
**Cause:** Regular users cannot modify their own role/locations

**Solution:** 
- Only SUPERADMIN can modify roles
- Login as SUPERADMIN to update user permissions

## Next Steps

After implementing RLS:
1. ✅ Test all user roles (NO_ROLE, SUPERADMIN, SALES_MANAGER, etc.)
2. ✅ Verify location-based filtering works for sales roles
3. ✅ Test user management (add/edit/delete) as SUPERADMIN
4. ✅ Test location management as SUPERADMIN
5. ⚠️ Consider adding audit logs for sensitive operations

## Security Best Practices

- 🔒 Never disable RLS in production
- 🔑 Rotate Supabase anon key if exposed
- 👥 Limit SUPERADMIN role to trusted administrators
- 📊 Monitor RLS policy performance with Supabase logs
- 🔍 Regular security audits of policy effectiveness
