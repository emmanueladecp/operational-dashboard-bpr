# Clerk Webhook Setup Guide

## Overview

This guide explains how to set up **Clerk Webhooks** to automatically sync user data from Clerk to Supabase. This follows the official Clerk + Supabase integration pattern using webhooks.

**Documentation Reference**: https://clerk.com/docs/guides/development/webhooks/syncing

## Why Use Webhooks?

Instead of manually creating users in the backend API, webhooks allow Clerk to **automatically notify your backend** when users are:
- Created (`user.created`)
- Updated (`user.updated`)
- Deleted (`user.deleted`)

This ensures your Supabase database stays in sync with Clerk automatically.

---

## Architecture

```
Clerk User Event → Clerk Webhook → Your Backend → Supabase Database
```

### Flow:
1. User created/updated/deleted in Clerk (via Dashboard, API, or sign-up)
2. Clerk sends webhook POST request to your backend
3. Backend verifies webhook signature (security)
4. Backend syncs data to Supabase
5. Backend returns 200 OK to Clerk

---

## Setup Steps

### 1. Environment Variables

Your `.env.local` should have:

```env
# Backend API Environment Variables
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
CLERK_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
```

**Where to find these**:

#### CLERK_SECRET_KEY
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **API Keys**
4. Copy the **Secret Key**

#### CLERK_WEBHOOK_SECRET
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **Webhooks** → **Endpoints**
4. Create a new endpoint (or select existing)
5. Copy the **Signing Secret** (starts with `whsec_`)

#### SUPABASE_SERVICE_ROLE_KEY
1. Go to https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **service_role** key (⚠️ Keep this secret!)

---

### 2. Configure Webhook in Clerk Dashboard

#### For Local Development (using ngrok):

1. **Install ngrok** (if not already installed):
   ```bash
   # Download from https://ngrok.com/download
   # Or install via npm
   npm install -g ngrok
   ```

2. **Start your backend server**:
   ```bash
   npm run server
   ```
   
   Server should be running on `http://localhost:3001`

3. **Start ngrok tunnel**:
   ```bash
   ngrok http 3001
   ```
   
   You'll get a forwarding URL like:
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:3001
   ```

4. **Configure webhook in Clerk**:
   - Go to https://dashboard.clerk.com
   - Select your application
   - Go to **Webhooks** → **Endpoints**
   - Click **+ Add Endpoint**
   - **Endpoint URL**: `https://abc123.ngrok.io/api/webhooks/clerk`
   - **Subscribe to events**:
     - ✅ `user.created`
     - ✅ `user.updated`
     - ✅ `user.deleted`
   - Click **Create**
   - **Copy the Signing Secret** and add to `.env.local` as `CLERK_WEBHOOK_SECRET`

#### For Production:

1. Deploy your backend to a public server (Vercel, Railway, AWS, etc.)
2. Get your production URL (e.g., `https://api.yourdomain.com`)
3. Configure webhook in Clerk:
   - **Endpoint URL**: `https://api.yourdomain.com/api/webhooks/clerk`
   - **Subscribe to events**: `user.created`, `user.updated`, `user.deleted`
   - Copy the **Signing Secret** to your production environment variables

---

### 3. Test the Webhook

#### Method 1: Create User in Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **Users**
4. Click **Create User**
5. Fill in details and click **Create**
6. Check your backend logs - you should see:
   ```
   Webhook received: user.created for user user_xxx
   ✅ User created in Supabase: username (user_xxx)
   ```

#### Method 2: Create User via Backend API

```bash
curl -X POST http://localhost:3001/api/users/create \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "password": "Password123",
    "role": "SALES_MANAGER_ROLE",
    "locations": ["Jakarta"]
  }'
```

The webhook should fire automatically after user creation.

#### Method 3: Test from Clerk Dashboard

1. Go to **Webhooks** → **Endpoints**
2. Select your endpoint
3. Click **Testing** tab
4. Click **Send Example** for `user.created` event
5. Check your backend logs

---

## Webhook Event Handlers

### user.created

Triggered when a new user is created in Clerk.

**What it does**:
1. Extracts user data from webhook payload
2. Gets role and locations from `public_metadata`
3. Creates user record in Supabase `users` table

**Supabase Insert**:
```javascript
{
  clerk_id: "user_xxx",
  name: "username",
  role: "SALES_MANAGER_ROLE",
  locations: ["Jakarta", "Surabaya"]
}
```

### user.updated

Triggered when a user is updated in Clerk (username, metadata, etc.).

**What it does**:
1. Extracts updated user data
2. Gets updated role and locations from `public_metadata`
3. Updates user record in Supabase

**Supabase Update**:
```javascript
UPDATE users SET
  name = "new_username",
  role = "SALES_SUPERVISOR_ROLE",
  locations = ["Bandung"]
WHERE clerk_id = "user_xxx"
```

### user.deleted

Triggered when a user is deleted from Clerk.

**What it does**:
1. Extracts user ID
2. Deletes user record from Supabase

**Supabase Delete**:
```javascript
DELETE FROM users WHERE clerk_id = "user_xxx"
```

---

## Webhook Security

### Signature Verification

All webhooks are verified using **Svix** (Clerk's webhook provider):

1. Clerk signs each webhook with your **Signing Secret**
2. Backend verifies the signature using the Svix library
3. Only verified webhooks are processed
4. Invalid signatures are rejected (400 error)

**Security Benefits**:
- ✅ Prevents unauthorized requests
- ✅ Ensures webhooks are from Clerk
- ✅ Protects against replay attacks
- ✅ Industry-standard security (HMAC)

---

## Troubleshooting

### Webhook Not Firing

**Problem**: Created user but webhook didn't fire

**Solutions**:
1. Check if webhook is configured in Clerk Dashboard
2. Verify endpoint URL is correct
3. Check if events are subscribed (`user.created`, etc.)
4. Look at webhook logs in Clerk Dashboard
5. Ensure backend is running and accessible

---

### Signature Verification Failed

**Problem**: Webhook received but signature verification fails

**Solutions**:
1. Check `CLERK_WEBHOOK_SECRET` in `.env.local`
2. Make sure you copied the correct Signing Secret
3. Verify secret hasn't been regenerated in Clerk
4. Check backend logs for detailed error

---

### User Not Created in Supabase

**Problem**: Webhook fires but user not in Supabase

**Solutions**:
1. Check backend logs for Supabase errors
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
3. Check Supabase table schema matches
4. Verify RLS policies allow insert with service role
5. Check if `clerk_id` already exists (duplicate)

---

### ngrok Connection Issues

**Problem**: ngrok tunnel not working

**Solutions**:
1. Make sure ngrok is authenticated: `ngrok authtoken YOUR_TOKEN`
2. Check if port 3001 is correct
3. Restart ngrok tunnel
4. Update webhook URL in Clerk if ngrok URL changed

---

### Webhook Delays

**Problem**: Webhook takes time to sync

**Note**: Webhook deliveries can have delays (not guaranteed instant delivery)

**Solutions**:
- Clerk automatically retries failed webhooks
- Check webhook logs in Clerk Dashboard for delivery status
- For critical real-time sync, consider using Clerk's Backend API directly

---

## Production Considerations

### 1. Idempotency

Webhooks can be delivered multiple times. Ensure your handlers are idempotent:

```javascript
// Example: Use upsert instead of insert
await supabaseAdmin.from('users').upsert({
  clerk_id: id,
  name: username,
  role: role,
  locations: locations
}, { onConflict: 'clerk_id' });
```

### 2. Error Handling

Always return 200 OK to Clerk, even on errors:

```javascript
if (error) {
  console.error('Error:', error);
  // Still return 200 to prevent retries
  // Log error for manual review
}
return res.json({ success: true });
```

### 3. Monitoring

- Monitor webhook logs in Clerk Dashboard
- Set up alerts for failed webhooks
- Log all webhook events to your monitoring system
- Track webhook processing times

### 4. Rate Limiting

- Webhooks can arrive in bursts
- Ensure your backend can handle multiple concurrent requests
- Consider queueing webhooks for processing

---

## Webhook vs Direct API

### When to Use Webhooks:
✅ Automatic syncing without manual API calls  
✅ Users created in Clerk Dashboard should sync  
✅ Users created via OAuth sign-up should sync  
✅ Multiple systems need to stay in sync  

### When to Use Direct API:
✅ Need immediate confirmation of sync  
✅ Custom validation before creating user  
✅ Need to set initial data not in Clerk  
✅ Transactional operations (create user + other data)  

### Hybrid Approach (Recommended):
- Use **webhooks** for automatic syncing (sign-ups, dashboard)
- Use **direct API** for SUPERADMIN user creation with immediate validation
- Both can coexist safely

---

## Current Implementation

### Webhook Endpoint

**URL**: `POST /api/webhooks/clerk`

**Events Handled**:
- `user.created`
- `user.updated`
- `user.deleted`

**Security**: Svix signature verification

**Syncs To**: Supabase `users` table

### Manual API Endpoints (Still Available)

These endpoints can be used alongside webhooks:

- `POST /api/users/create` - Manual user creation
- `PATCH /api/users/:userId` - Update user role/locations
- `DELETE /api/users/:userId` - Delete user

Both methods update Clerk `publicMetadata` and Supabase for consistency.

---

## Testing Checklist

- [ ] Backend server running on port 3001
- [ ] ngrok tunnel exposing backend (for local dev)
- [ ] Webhook configured in Clerk Dashboard
- [ ] Webhook URL is correct
- [ ] Events subscribed: `user.created`, `user.updated`, `user.deleted`
- [ ] `CLERK_WEBHOOK_SECRET` set in `.env.local`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local`
- [ ] Create test user in Clerk Dashboard
- [ ] Check backend logs for webhook receipt
- [ ] Verify user created in Supabase `users` table
- [ ] Test user update (change username/metadata)
- [ ] Verify user updated in Supabase
- [ ] Test user deletion
- [ ] Verify user deleted from Supabase

---

## Next Steps

1. **Configure webhook** in Clerk Dashboard
2. **Start backend server**: `npm run server`
3. **Start ngrok** (local dev): `ngrok http 3001`
4. **Test webhook** by creating a user in Clerk
5. **Monitor logs** to ensure sync works
6. **Update webhook URL** when deploying to production

---

## Resources

- [Clerk Webhooks Documentation](https://clerk.com/docs/guides/development/webhooks/syncing)
- [Svix Webhook Verification](https://docs.svix.com/receiving/verifying-payloads/how)
- [ngrok Documentation](https://ngrok.com/docs)
- [Supabase Service Role Key](https://supabase.com/docs/guides/api#api-keys)

---

## Support

If you encounter issues:
1. Check backend server logs
2. Check Clerk webhook logs in Dashboard
3. Verify all environment variables are set
4. Test with example webhook from Clerk Dashboard
5. Check Supabase table permissions and RLS policies
