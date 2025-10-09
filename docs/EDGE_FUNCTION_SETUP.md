# Edge Function Setup Guide

## Overview
This guide explains how to deploy and configure the Supabase Edge Function that handles secure Clerk user creation, updates, and deletion for the operational dashboard.

## Architecture
- **Frontend**: Dashboard.tsx calls Supabase Edge Function
- **Edge Function**: Securely handles Clerk Backend API calls using secret keys
- **Security**: No secrets exposed to frontend; all sensitive operations server-side

## Prerequisites
1. **Supabase CLI** installed (see https://github.com/supabase/cli#install-the-cli for installation options)
2. **Supabase Project**: Already set up (`idniillfrvnppeerzxol`)
3. **Clerk Account**: Already configured with Supabase integration

## Deployment Steps

### 1. Login to Supabase CLI
```bash
supabase login
```

### 2. Link Your Project
```bash
supabase link --project-ref idniillfrvnppeerzxol
```

### 3. Set Environment Secrets
Set the required secrets for the Edge Function:

```bash
supabase secrets set CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here
```

**Where to find CLERK_SECRET_KEY**:
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **API Keys** in the sidebar
4. Copy the **Secret Key** (starts with `sk_test_` or `sk_live_`)

### 4. Deploy the Edge Function
```bash
supabase functions deploy create-user
```

You should see:
```
Deployed Function create-user on project idniillfrvnppeerzxol
```

### 5. Verify Deployment
Test the function with a simple curl (replace with your Supabase URL):

```bash
curl -X POST "https://idniillfrvnppeerzxol.supabase.co/functions/v1/create-user" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "create-user", "username": "test", "password": "test123456", "role": "SALES_MANAGER_ROLE", "locations": ["Jakarta"]}'
```

## Environment Variables Required

The Edge Function needs these environment variables (set via `supabase secrets`):

| Variable | Description | Required |
|----------|-------------|----------|
| `CLERK_SECRET_KEY` | Clerk Backend API secret key | Yes |
| `SUPABASE_URL` | Your Supabase project URL | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Auto-set by Supabase |

## API Endpoints

### POST /create-user (Create User)
Creates a new user in both Clerk and Supabase.

**Request Body**:
```json
{
  "action": "create-user",
  "username": "john_doe",
  "password": "SecurePassword123",
  "role": "SALES_MANAGER_ROLE",
  "locations": ["Jakarta", "Surabaya"]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "clerk_id": "user_xxx",
    "name": "john_doe",
    "role": "SALES_MANAGER_ROLE",
    "locations": ["Jakarta", "Surabaya"]
  }
}
```

### PATCH /update-user (Update User)
Updates user role and/or locations in both Clerk and Supabase.

**Request Body**:
```json
{
  "action": "update-user",
  "clerkId": "user_xxx",
  "role": "SALES_SUPERVISOR_ROLE",
  "locations": ["Bandung"]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User updated successfully"
}
```

### DELETE /delete-user (Delete User)
Deletes user from both Clerk and Supabase.

**Request Body**:
```json
{
  "action": "delete-user",
  "clerkId": "user_xxx"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

## Frontend Integration

The frontend (Dashboard.tsx) automatically calls these endpoints via:

```typescript
const { data, error } = await supabaseClient.functions.invoke('create-user', {
  body: {
    action: 'create-user',
    username: newUsername,
    password: newPassword,
    role: newUserRole,
    locations: selectedLocations
  }
});
```

## Troubleshooting

### Deployment Issues

**Problem**: "supabase: command not found"
**Solution**: Install Supabase CLI: `npm install -g supabase`

**Problem**: "Failed to link project"
**Solution**: Verify project ref: `idniillfrvnppeerzxol`

**Problem**: "Permission denied" when setting secrets
**Solution**: Ensure you're logged in: `supabase login`

### Function Errors

**Problem**: "Failed to create user in Clerk"
**Solution**: Check CLERK_SECRET_KEY is correct and has user creation permissions

**Problem**: "Failed to create user in database"
**Solution**: Verify RLS policies allow SUPERADMIN inserts (run `supabase_rls_policies_fixed.sql`)

**Problem**: CORS errors in browser
**Solution**: Edge Function handles CORS automatically; check if function is deployed

### Testing

**Problem**: Function returns 500 error
**Solution**: Check Supabase logs: `supabase functions logs create-user`

**Problem**: User created in Clerk but not Supabase
**Solution**: Function includes rollback; check logs for specific error

## Security Notes

⚠️ **IMPORTANT**:
- Never commit `CLERK_SECRET_KEY` to version control
- Edge Functions run server-side with proper isolation
- All user creation/update/deletion requires SUPERADMIN role (enforced by RLS)
- Input validation prevents injection attacks

## Production Deployment

For production:
1. Use production Clerk secret key (`sk_live_` instead of `sk_test_`)
2. Set secrets in production Supabase dashboard (not CLI)
3. Monitor function logs for errors
4. Set up proper error alerting

## File Structure

```
supabase/
  functions/
    create-user/
      index.ts          # Main Edge Function code
```

## Support

If you encounter issues:
1. Check Supabase function logs: `supabase functions logs create-user`
2. Verify all secrets are set correctly
3. Test with simple curl requests first
4. Check browser network tab for frontend errors