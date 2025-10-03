# Quick Start Guide

## 🚀 Get Started in 5 Minutes

Follow these steps to set up user syncing between Clerk and Supabase.

---

## Prerequisites

✅ Clerk account with application created  
✅ Supabase project created  
✅ Node.js installed  
✅ All dependencies installed (`npm install`)  

---

## Step 1: Environment Variables

Update your `.env.local` file with these keys:

```env
# Frontend
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Backend
CLERK_SECRET_KEY=sk_test_your_secret_key
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3001
```

**Where to get these**:
- **CLERK_SECRET_KEY**: Clerk Dashboard → API Keys → Secret Key
- **CLERK_WEBHOOK_SECRET**: Clerk Dashboard → Webhooks → (you'll get this in Step 3)
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase → Settings → API → service_role key

---

## Step 2: Start Backend Server

```bash
npm run server
```

You should see:
```
🚀 Backend server running on http://localhost:3001
✅ Health check: http://localhost:3001/api/health
📡 Webhook endpoint: http://localhost:3001/api/webhooks/clerk
```

---

## Step 3: Configure Clerk Webhook

### Option A: Using Svix Play (Testing - View webhooks in browser)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → Your App → **Webhooks**
2. Click **+ Add Endpoint**
3. Enter URL: `https://play.svix.com/in/e_ERPzgFWqkB0IirmrLtBq7unn4az/`
4. Subscribe to:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
5. Click **Create**

**Test**: Create a user in Clerk → View webhook at https://play.svix.com/in/e_ERPzgFWqkB0IirmrLtBq7unn4az/

### Option B: Using Your Backend (Syncing - Saves to Supabase)

1. **Install ngrok** (if not installed):
   ```bash
   npm install -g ngrok
   ```

2. **Start ngrok** (in a new terminal):
   ```bash
   ngrok http 3001
   ```
   
   Copy the forwarding URL (e.g., `https://abc123.ngrok-free.app`)

3. **Configure in Clerk**:
   - Go to [Clerk Dashboard](https://dashboard.clerk.com) → Webhooks
   - Click **+ Add Endpoint**
   - Enter URL: `https://abc123.ngrok-free.app/api/webhooks/clerk`
   - Subscribe to: `user.created`, `user.updated`, `user.deleted`
   - Click **Create**
   - **Copy the Signing Secret** (starts with `whsec_`)

4. **Update `.env.local`**:
   ```env
   CLERK_WEBHOOK_SECRET=whsec_your_copied_secret
   ```

5. **Restart backend** to load new secret:
   ```bash
   npm run server
   ```

### Option C: BOTH (Recommended for Development)

Set up **both** Option A and Option B to:
- See webhooks in Svix Play (debugging)
- Sync to Supabase via your backend

---

## Step 4: Test User Creation

### Method 1: Via Clerk Dashboard

1. Go to Clerk Dashboard → **Users**
2. Click **Create User**
3. Enter:
   - Username: `test_user`
   - Password: `TestPassword123`
4. Click **Create**

**Check**:
- **Svix Play**: View webhook at your Svix Play URL
- **Backend Logs**: Should see `✅ User created in Supabase: test_user`
- **Supabase**: Check `users` table for new record

### Method 2: Via API

```bash
curl -X POST http://localhost:3001/api/users/create \
  -H "Content-Type: application/json" \
  -d '{
    "username": "api_test_user",
    "password": "Password123",
    "role": "SALES_MANAGER_ROLE",
    "locations": ["Jakarta"]
  }'
```

Webhook will fire automatically after Clerk creates the user!

---

## Step 5: Start Frontend

In a new terminal:

```bash
npm run dev
```

Open browser at `http://localhost:3000`

**Test the full flow**:
1. Login as SUPERADMIN
2. Go to **Management User** tab
3. Click **Tambah User**
4. Fill in form
5. Click **Simpan**
6. Check Supabase - user should be created!

---

## Architecture Overview

```
┌─────────────────┐
│  Clerk Dashboard │
│  (Create User)   │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐     Webhook      ┌──────────────────┐
│     Clerk       │ ───────────────► │  Your Backend    │
│  (User Event)   │                  │  (server.js)     │
└─────────────────┘                  └────────┬─────────┘
         │                                     │
         │ (Optional)                          │ Syncs
         ▼                                     ▼
┌─────────────────┐                  ┌──────────────────┐
│   Svix Play     │                  │    Supabase      │
│   (Debug View)  │                  │  (users table)   │
└─────────────────┘                  └──────────────────┘
```

---

## Verification Checklist

- [ ] Backend server running on port 3001
- [ ] Webhook configured in Clerk (Svix Play or ngrok)
- [ ] `CLERK_WEBHOOK_SECRET` set in `.env.local`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local`
- [ ] Created test user in Clerk Dashboard
- [ ] Viewed webhook in Svix Play (if configured)
- [ ] Checked backend logs for sync confirmation
- [ ] Verified user exists in Supabase `users` table
- [ ] Frontend running and accessible
- [ ] Can create users from dashboard as SUPERADMIN

---

## Common Issues

### Backend won't start
**Problem**: `Error: Cannot find module`  
**Solution**: Run `npm install`

### Webhook not received
**Problem**: No webhook in Svix Play or backend logs  
**Solution**: 
- Check webhook is configured in Clerk
- Verify events are subscribed
- Check ngrok is running (if using backend)

### User not in Supabase
**Problem**: Webhook received but user not created  
**Solution**:
- Check backend logs for errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check Supabase table exists and has correct schema

### Signature verification failed
**Problem**: `Error verifying webhook: Invalid signature`  
**Solution**:
- Copy the correct signing secret from Clerk
- Update `CLERK_WEBHOOK_SECRET` in `.env.local`
- Restart backend server

---

## Next Steps

Once everything is working:

1. **Test all webhook events**:
   - Create user → Check sync
   - Update user → Check sync
   - Delete user → Check sync

2. **Test role/location assignment**:
   - Create user with role and locations
   - Verify `public_metadata` in Clerk
   - Verify data in Supabase

3. **Deploy to production**:
   - Deploy backend to public server
   - Update webhook URL to production
   - Remove Svix Play endpoint
   - Update environment variables

---

## Documentation

- **Webhook Setup**: See `WEBHOOK_SETUP_GUIDE.md`
- **Svix Play Testing**: See `SVIX_PLAY_SETUP.md`
- **Clerk Integration**: See `CLERK_SUPABASE_INTEGRATION.md`
- **User Creation**: See `USER_CREATION_SETUP.md`

---

## Support

**Having issues?**
1. Check backend logs for errors
2. Check Clerk webhook logs in Dashboard
3. Test with Svix Play to verify webhooks work
4. Verify all environment variables are set
5. Ensure Supabase service role key is correct

**Everything working?**
🎉 You're all set! Users created in Clerk will automatically sync to Supabase.
