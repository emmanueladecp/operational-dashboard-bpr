# Clerk + Supabase Integration Pattern

## Overview

This project follows the **official Clerk + Supabase Native Integration** pattern as documented at:
https://clerk.com/docs/guides/development/integrations/databases/supabase

## Architecture

### Key Components

1. **Clerk**: Handles user authentication and stores user metadata
2. **Supabase**: Stores application data with Row-Level Security (RLS)
3. **JWT Tokens**: Clerk session tokens are used to authenticate with Supabase
4. **Public Metadata**: Role and location data stored in Clerk, synced to Supabase

### Data Flow

```
User Login → Clerk Auth → JWT Token (with publicMetadata) → Supabase RLS Policies
```

## User Metadata Storage

### Clerk publicMetadata
Stores user role and locations that need to be accessible in JWT tokens:

```json
{
  "publicMetadata": {
    "role": "SALES_MANAGER_ROLE",
    "locations": ["Jakarta", "Surabaya"]
  }
}
```

**Why publicMetadata?**
- Included in JWT session tokens automatically
- Accessible from both frontend and backend
- Can be used in Supabase RLS policies
- Limited to 8KB (keep session token under 1.2KB recommended)

### Supabase Database
Stores the same data for easier querying:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  locations TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## User Creation Flow

When a SUPERADMIN creates a new user:

1. **Frontend calls Supabase Edge Function** with:
    ```json
    {
      "action": "create-user",
      "username": "john_doe",
      "password": "SecurePassword123",
      "role": "SALES_MANAGER_ROLE",
      "locations": ["Jakarta", "Surabaya"]
    }
    ```

2. **Edge Function creates user in Clerk** with publicMetadata:
    ```typescript
    const clerkUser = await clerk.users.createUser({
      username: username,
      password: password,
      publicMetadata: {
        role: role,
        locations: locations
      }
    });
    ```

3. **Edge Function creates matching record in Supabase**:
    ```typescript
    await supabaseAdmin.from('users').insert({
      clerk_id: clerkUser.id,
      name: username,
      role: role,
      locations: locations
    });
    ```

4. **User can immediately login**
    - No email verification needed
    - Username + password authentication

5. **On login, JWT token contains**:
    ```json
    {
      "sub": "user_xxx",
      "role": "SALES_MANAGER_ROLE",
      "locations": ["Jakarta", "Surabaya"]
    }
    ```

## User Update Flow

When a SUPERADMIN updates user role or locations:

1. **Frontend calls Edge Function** with:
    ```json
    {
      "action": "update-user",
      "clerkId": "user_xxx",
      "role": "SALES_SUPERVISOR_ROLE",
      "locations": ["Bandung"]
    }
    ```

2. **Edge Function updates Clerk metadata**:
    ```typescript
    await clerk.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: role,
        locations: locations
      }
    });
    ```

3. **Edge Function updates Supabase record**:
    ```typescript
    await supabaseAdmin.from('users')
      .update({ role, locations })
      .eq('clerk_id', clerkId);
    ```

4. **Important**: Metadata changes reflect in JWT after next token refresh
    - Frontend may need to refresh session to see changes
    - Consider adding a "refresh session" button after updates

## RLS Policies

Supabase RLS policies use the Clerk user ID from the JWT token:

```sql
-- Get Clerk user ID from JWT token
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  );
$$ LANGUAGE SQL STABLE;

-- Example RLS policy
CREATE POLICY "Users can read own data"
ON users FOR SELECT
USING (clerk_id = requesting_user_id());

-- Example using metadata (if needed in future)
CREATE OR REPLACE FUNCTION requesting_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    ''
  );
$$ LANGUAGE SQL STABLE;
```

## Frontend Integration

### Supabase Client Setup

The frontend uses a custom Supabase client that injects Clerk tokens:

```typescript
// src/lib/supabase.ts
export function createClerkSupabaseClient(getToken: () => Promise<string | null>) {
  setClerkTokenGetter(getToken);
  return supabaseClient; // Singleton with custom fetch
}

// Usage in Dashboard.tsx
const { session } = useSession();
const supabaseClient = useMemo(() => {
  if (!session) return null;
  return createClerkSupabaseClient(() => session.getToken());
}, [session]);
```

### How It Works

1. Every Supabase request includes the Clerk JWT token in the `Authorization` header
2. Supabase validates the JWT using the Clerk JWKS endpoint
3. RLS policies use the JWT claims (`sub`, `role`, `locations`)
4. Users can only access data allowed by RLS policies

## API Endpoints

### POST /create-user (Supabase Edge Function)
Creates user in both Clerk (with metadata) and Supabase.

**Required**: `username`, `password`, `role`
**Optional**: `locations`

### PATCH /update-user (Supabase Edge Function)
Updates user role/locations in both Clerk metadata and Supabase.

**Required**: `clerkId` and at least one of `role` or `locations`

### DELETE /delete-user (Supabase Edge Function)
Deletes user from both Clerk and Supabase.

**Required**: `clerkId`

## Benefits of This Pattern

✅ **Single Source of Truth**: Clerk manages authentication, metadata in JWT
✅ **Automatic Sync**: JWT automatically includes role/locations
✅ **Security**: RLS policies use JWT claims directly
✅ **No Manual Token Handling**: Clerk SDK handles token refresh
✅ **Scalability**: Metadata in JWT reduces database queries
✅ **Serverless**: Edge Functions provide secure backend without maintaining servers
✅ **Official Pattern**: Follows Clerk + Supabase best practices

## Important Considerations

### Metadata Size Limits
- **publicMetadata**: Max 8KB
- **Session Token**: Keep under 1.2KB (recommended)
- Store minimal data in metadata (IDs, roles, not full objects)

### Session Token Refresh
- Metadata changes don't reflect immediately in active sessions
- Users need to refresh their session to see updated metadata
- Consider implementing session refresh after metadata updates

### Data Consistency
- Always update both Clerk metadata AND Supabase
- Use transactions/error handling to maintain consistency
- If Clerk update fails, don't update Supabase (and vice versa)

### RLS Policy Design
- Primary data source: Supabase database (easier queries)
- JWT metadata: For authorization checks in RLS policies
- Don't rely solely on JWT metadata for complex queries

## Migration Notes

If migrating from a different pattern:

1. **Add publicMetadata to existing users**:
   ```javascript
   // For each existing user
   await clerkClient.users.updateUserMetadata(clerkId, {
     publicMetadata: {
       role: user.role,
       locations: user.locations
     }
   });
   ```

2. **Update RLS policies** to use JWT claims if needed

3. **Test token size**: Ensure JWT stays under 1.2KB

## Troubleshooting

**Problem**: Changes not reflected after update  
**Solution**: User needs to refresh session (logout/login or token refresh)

**Problem**: JWT token too large  
**Solution**: Reduce metadata size, store only IDs not full objects

**Problem**: RLS policy not working  
**Solution**: Check JWT claims in Supabase logs, verify `requesting_user_id()` function

## References

- [Clerk + Supabase Integration Guide](https://clerk.com/docs/guides/development/integrations/databases/supabase)
- [Clerk User Metadata](https://clerk.com/docs/users/metadata)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Clerk Backend SDK](https://clerk.com/docs/references/backend/overview)
