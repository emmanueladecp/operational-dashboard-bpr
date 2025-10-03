# User Creation Setup Guide

## Overview
This guide explains how to set up the complete user creation system that creates users in both Clerk and Supabase with proper role and location assignments.

## Architecture

### Flow
1. SUPERADMIN clicks "Tambah User" button in Dashboard
2. Form collects: Email, First Name, Last Name, Role, and Locations
3. Frontend sends request to Backend API (Node.js/Express)
4. Backend creates user in Clerk first
5. Backend creates matching record in Supabase with `clerk_id`
6. User receives invitation email from Clerk
7. User signs up via Clerk invitation link
8. On first login, user data syncs and RLS policies apply based on role

### Components
- **Frontend**: Dashboard.tsx (React component with user form)
- **Backend**: server.js (Express API for Clerk + Supabase integration)
- **Database**: Supabase with RLS policies
- **Auth**: Clerk for authentication

---

## Setup Steps

### 1. Environment Variables

Update `.env.local` with the following keys:

```env
# Frontend (existing)
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend (NEW - add these)
CLERK_SECRET_KEY=your_clerk_secret_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
```

#### Where to find these keys:

**CLERK_SECRET_KEY**:
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **API Keys** in the sidebar
4. Copy the **Secret Key** (starts with `sk_test_` or `sk_live_`)

**SUPABASE_SERVICE_ROLE_KEY**:
1. Go to https://app.supabase.com
2. Select your project: `idniillfrvnppeerzxol`
3. Go to **Settings** → **API**
4. Copy the **service_role** key (⚠️ KEEP THIS SECRET - has admin access)

---

### 2. Start the Backend Server

Open a **separate terminal** and run:

```bash
npm run server
```

You should see:
```
🚀 Backend server running on http://localhost:3001
✅ Health check: http://localhost:3001/api/health
```

**Important**: Keep this terminal running while using the application.

---

### 3. Start the Frontend (in another terminal)

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

### POST `/api/users/create`
Creates a new user in both Clerk and Supabase.

**Request Body**:
```json
{
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
    "username": "john_doe",
    "role": "SALES_MANAGER_ROLE",
    "locations": ["Jakarta", "Surabaya"]
  }
}
```

---

### DELETE `/api/users/:userId`
Deletes a user from both Clerk and Supabase.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### GET `/api/health`
Health check endpoint to verify backend is running.

**Response** (200 OK):
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

---

## Troubleshooting

### Backend Server Issues

**Problem**: Server won't start
```
Error: Cannot find module 'express'
```
**Solution**: Run `npm install` to install all dependencies

---

**Problem**: Missing environment variables
```
Error: CLERK_SECRET_KEY is not defined
```
**Solution**: Make sure `.env.local` has all required keys (see Step 1)

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

### CORS Errors

**Problem**: "Access-Control-Allow-Origin" error in browser console
**Solution**: Backend is not running. Start it with `npm run server`

---

**Problem**: "Failed to fetch" or "Network error"
**Solution**: 
- Verify backend is running on port 3001
- Check if another app is using port 3001
- Try changing PORT in `.env.local` and restart server

---

## Security Notes

⚠️ **IMPORTANT SECURITY CONSIDERATIONS**:

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Service Role Key** has ADMIN access - keep it secret
3. **Clerk Secret Key** can create/delete users - keep it secret
4. Backend should be deployed separately with proper security:
   - Use environment variables (not `.env.local` in production)
   - Add authentication middleware to API endpoints
   - Use HTTPS in production
   - Implement rate limiting
   - Add request validation

---

## Production Deployment

For production, you should:

1. **Deploy Backend Separately**:
   - Use Vercel Serverless Functions, AWS Lambda, or dedicated server
   - Set environment variables in deployment platform
   - Enable HTTPS

2. **Update Frontend API URL**:
   - Change `http://localhost:3001` to your production backend URL
   - Use environment variable for API URL

3. **Secure API Endpoints**:
   - Add JWT verification using Clerk's middleware
   - Validate user role before allowing user creation
   - Add rate limiting

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
- `server.js` - Backend API server
- `USER_CREATION_SETUP.md` - This documentation

**Modified Files**:
- `package.json` - Added server script and dependencies
- `.env.local` - Added backend environment variables
- `src/components/Dashboard.tsx` - Added user creation form and logic

---

## Support

If you encounter issues not covered in this guide:
1. Check browser console for error messages
2. Check backend terminal for API errors
3. Verify all environment variables are set correctly
4. Ensure RLS policies are applied in Supabase (see `NEXT_STEPS.md`)
