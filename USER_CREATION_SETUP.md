# User Creation Setup Guide

## Overview
This guide explains how to set up the complete user creation system that creates users in both Clerk and Supabase with proper role and location assignments.

## Architecture

### Flow
1. SUPERADMIN clicks "Tambah User" button in Dashboard
2. Form collects: Username, Password, Role, and Locations
3. Frontend calls Supabase Edge Function (secure serverless function)
4. Edge Function creates user in Clerk first (with metadata)
5. Edge Function creates matching record in Supabase with `clerk_id`
6. User can immediately login with username/password (no email required)
7. On login, JWT contains role/locations for RLS policies

### Components
- **Frontend**: Dashboard.tsx (React component with user form)
- **Backend**: Supabase Edge Function (serverless, secure, no server management)
- **Database**: Supabase with RLS policies
- **Auth**: Clerk for authentication

---

## Setup Steps

### 1. Environment Variables

Update `.env.local` with the following keys (if not already set):

```env
# Frontend (existing)
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Where to find these keys:

**VITE_CLERK_PUBLISHABLE_KEY**:
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **API Keys** in the sidebar
4. Copy the **Publishable Key** (starts with `pk_test_` or `pk_live_`)

**VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY**:
1. Go to https://app.supabase.com
2. Select your project: `idniillfrvnppeerzxol`
3. Go to **Settings** → **API**
4. Copy the **URL** and **anon/public** key

---

### 2. Deploy the Edge Function

Deploy the Supabase Edge Function that handles secure Clerk integration:

```bash
# Install Supabase CLI if not already installed (see https://github.com/supabase/cli#install-the-cli)
# For example, using curl:
# curl -sSfL https://supabase.com/install.sh | sh

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref idniillfrvnppeerzxol

# Set the Clerk secret key as a secret
supabase secrets set CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here

# Deploy the Edge Function
supabase functions deploy create-user
```

**Where to find CLERK_SECRET_KEY**:
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **API Keys** in the sidebar
4. Copy the **Secret Key** (starts with `sk_test_` or `sk_live_`)

You should see:
```
Deployed Function create-user on project idniillfrvnppeerzxol
```

---

### 3. Start the Frontend

```bash
npm run dev
```

Your app will run on `http://localhost:3000`

---

## Usage

### Creating a New User

1. **Login as SUPERADMIN**
   - Only users with `SUPERADMIN_ROLE` can create users

2. **Navigate to User Management Tab**
   - Click on the "Management User" tab in the dashboard

3. **Click "Tambah User" Button**
   - A dialog will open with the new user form

4. **Fill in the Form**:
   - **Username*** (required): User's login username
   - **Password*** (required): Minimum 8 characters
   - **Role*** (required): Select from:
     - Super Admin
     - BOD
     - Sales Manager
     - Sales Supervisor
     - Auditor
   - **Lokasi**: Check all locations this user should have access to

5. **Click "Simpan"**
   - Backend creates user in Clerk with username and password
   - Backend creates user record in Supabase with assigned role and locations
   - Success message appears with the username
   - User list refreshes automatically

6. **User Login**
   - User can immediately login using the created username and password
   - No email verification required
   - On first login, they'll have access based on assigned role and locations

---

## Editing Existing Users

1. Click the **Edit** button (pencil icon) next to any user
2. Update their **Role** and/or **Locations**
3. Click "Simpan"
4. Changes are saved to Supabase immediately

**Note**: You cannot change email or name for existing users (these are managed by Clerk)

---

## Deleting Users

1. Click the **Delete** button (trash icon) next to any user
2. Confirm the deletion
3. User is deleted from **both Clerk and Supabase**

---

## API Endpoints

### POST /create-user (Supabase Edge Function)
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

---

### PATCH /update-user (Supabase Edge Function)
Updates user role/locations in both Clerk and Supabase.

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

---

### DELETE /delete-user (Supabase Edge Function)
Deletes a user from both Clerk and Supabase.

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

---

## Troubleshooting

### Edge Function Issues

**Problem**: Deployment fails
```
Error: supabase: command not found
```
**Solution**: Install Supabase CLI using one of the supported methods from https://github.com/supabase/cli#install-the-cli

---

**Problem**: "Failed to link project"
```
Error: Could not find project
```
**Solution**: Verify project ref: `idniillfrvnppeerzxol` and you're logged in

---

### User Creation Errors

**Problem**: "Failed to create user: Username already exists"
**Solution**: The username is already registered in Clerk. Use a different username or delete the existing user first.

---

**Problem**: "Failed to create user in database"
**Solution**: 
- Check if Supabase connection is working
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check if RLS policies are applied (see `NEXT_STEPS.md`)

---

**Problem**: "Failed to create user: Clerk validation error"
**Solution**: 
- Verify username is alphanumeric (letters, numbers, underscores)
- Check that password is at least 8 characters
- Review Clerk error details in console

---

### Edge Function Errors

**Problem**: "Failed to create user in Clerk"
**Solution**: Check CLERK_SECRET_KEY is correct and has user creation permissions

---

**Problem**: "Failed to create user in database"
**Solution**:
- Verify RLS policies allow SUPERADMIN inserts (run `supabase_rls_policies_fixed.sql`)
- Check Supabase service role key is correct
- Check function logs: `supabase functions logs create-user`

---

## Security Notes

⚠️ **IMPORTANT SECURITY CONSIDERATIONS**:

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Service Role Key** has ADMIN access - keep it secret
3. **Clerk Secret Key** can create/delete users - keep it secret (set via `supabase secrets`)
4. Edge Functions provide built-in security:
    - Run in isolated serverless environment
    - Automatic HTTPS and CORS handling
    - Built-in request validation and rate limiting
    - No need for separate server deployment

---

## Production Deployment

For production, you should:

1. **Deploy Edge Function**:
    - Use production Clerk secret key (`sk_live_` instead of `sk_test_`)
    - Set secrets in production Supabase dashboard (not CLI)
    - Function auto-scales with demand

2. **No Frontend Changes Needed**:
    - Edge Functions use same Supabase client as frontend
    - No API URL changes required
    - Automatic HTTPS and security

3. **Built-in Security**:
    - RLS policies enforce SUPERADMIN-only access
    - Edge Functions run server-side with proper isolation
    - Input validation prevents injection attacks

4. **User Login**:
    - Users can immediately login with their username and password
    - No email verification or invitation process required

---

## Testing Checklist

- [ ] Backend server starts successfully
- [ ] Health check endpoint responds at http://localhost:3001/api/health
- [ ] SUPERADMIN can access User Management tab
- [ ] "Tambah User" button opens dialog with form
- [ ] Form validates required fields (username, password, role)
- [ ] Password validation (minimum 8 characters)
- [ ] New user is created in Clerk
- [ ] New user record appears in Supabase `users` table with correct:
  - [ ] `clerk_id`
  - [ ] `name` (set to username)
  - [ ] `role`
  - [ ] `locations` array
- [ ] User can immediately login with username and password
- [ ] User can access dashboard
- [ ] RLS policies correctly filter data based on user role
- [ ] Edit user updates role and locations
- [ ] Delete user removes from both Clerk and Supabase

---

## Files Modified/Created

**New Files**:
- `supabase/functions/create-user/index.ts` - Edge Function for secure Clerk integration
- `EDGE_FUNCTION_SETUP.md` - Edge Function deployment guide
- Updated `USER_CREATION_SETUP.md` - This documentation

**Modified Files**:
- `src/components/Dashboard.tsx` - Updated to use Edge Function instead of server.js API
- `CLERK_SUPABASE_INTEGRATION.md` - Updated to reflect Edge Function flow

---

## Support

If you encounter issues not covered in this guide:
1. Check browser console for error messages
2. Check backend terminal for API errors
3. Verify all environment variables are set correctly
4. Ensure RLS policies are applied in Supabase (see `NEXT_STEPS.md`)
