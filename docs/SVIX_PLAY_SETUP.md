# Using Svix Play for Webhook Testing

## What is Svix Play?

**Svix Play** is a webhook debugging/inspection tool that lets you:
- 👀 View incoming webhook requests in real-time
- 🔍 Inspect webhook payload structure
- ✅ Test webhook signatures
- 🐛 Debug webhook issues

**Your Svix Play URL**: `https://play.svix.com/in/e_ERPzgFWqkB0IirmrLtBq7unn4az/`

---

## Important Understanding

### What Svix Play DOES:
✅ Shows you webhook requests from Clerk
✅ Helps you see webhook payload structure
✅ Great for testing and debugging
✅ Verifies Clerk is sending webhooks correctly

### What Svix Play DOES NOT DO:
❌ Does NOT sync data to your Supabase
❌ Does NOT process or store webhooks
❌ Only a viewer/inspector tool

### To Actually Sync to Supabase:
You need **BOTH**:
1. **Svix Play** (for debugging) - Optional
2. **Your Backend** (for syncing) - **Required**

---

## Setup Options

### Option 1: Svix Play Only (Testing/Debugging)

Use this to see what webhooks look like before implementing sync.

**Steps**:
1. Go to Clerk Dashboard → Webhooks → Endpoints
2. Add endpoint: `https://play.svix.com/in/e_ERPzgFWqkB0IirmrLtBq7unn4az/`
3. Subscribe to: `user.created`, `user.updated`, `user.deleted`
4. Create a test user in Clerk
5. Go to your Svix Play URL in browser
6. You'll see the webhook payload!

**Use this for**:
- Understanding webhook structure
- Seeing what data Clerk sends
- Testing if Clerk webhooks are working
- Debugging webhook issues

**Limitation**: Data is NOT synced to Supabase

---

### Option 2: Your Backend Only (Production Sync)

Use this to actually sync data to Supabase.

**Steps**:
1. Start backend: `npm run server`
2. Expose via ngrok: `ngrok http 3001`
3. Get ngrok URL: `https://abc123.ngrok-free.app`
4. Configure in Clerk: `https://abc123.ngrok-free.app/api/webhooks/clerk`
5. Subscribe to: `user.created`, `user.updated`, `user.deleted`

**Use this for**:
- Actual production syncing
- Automatic Supabase updates
- Real user data management

---

### Option 3: BOTH (Recommended for Development)

Use both for the best debugging + syncing experience!

**Setup**:

1. **Configure BOTH endpoints in Clerk**:

   **Endpoint 1** (Debugging):
   - URL: `https://play.svix.com/in/e_ERPzgFWqkB0IirmrLtBq7unn4az/`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Purpose: Debug/inspect webhooks

   **Endpoint 2** (Syncing):
   - URL: `https://your-ngrok-url.ngrok-free.app/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Purpose: Sync to Supabase

2. **How it works**:
   - Clerk sends webhooks to BOTH endpoints
   - You see webhooks in Svix Play (debugging)
   - Your backend syncs to Supabase (production)

3. **Benefits**:
   - ✅ Real-time debugging
   - ✅ Actual data syncing
   - ✅ See issues before they reach your backend
   - ✅ Compare payloads

---

## Step-by-Step: Using Svix Play

### 1. Configure in Clerk

1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **Webhooks** → **Endpoints**
4. Click **+ Add Endpoint**
5. Fill in:
   ```
   Endpoint URL: https://play.svix.com/in/e_ERPzgFWqkB0IirmrLtBq7unn4az/
   Description: Svix Play Debugger (optional)
   ```
6. Subscribe to events:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
7. Click **Create**

### 2. Test Webhook Delivery

1. In Clerk Dashboard, go to **Users**
2. Click **Create User**
3. Fill in:
   ```
   Username: test_user_123
   Password: TestPassword123
   ```
4. Click **Create**

### 3. View in Svix Play

1. Open in browser: `https://play.svix.com/in/e_ERPzgFWqkB0IirmrLtBq7unn4az/`
2. You should see the webhook request appear!
3. Click on the request to see full details

**Example Payload**:
```json
{
  "type": "user.created",
  "data": {
    "id": "user_2xxx",
    "username": "test_user_123",
    "first_name": null,
    "last_name": null,
    "public_metadata": {},
    "created_at": 1234567890,
    ...
  }
}
```

---

## Adding Your Backend for Actual Syncing

Once you've tested with Svix Play, add your backend:

### 1. Ensure Backend is Running

```bash
npm run server
```

Check logs:
```
🚀 Backend server running on http://localhost:3001
✅ Health check: http://localhost:3001/api/health
📡 Webhook endpoint: http://localhost:3001/api/webhooks/clerk
```

### 2. Expose Backend with ngrok

```bash
ngrok http 3001
```

Copy the forwarding URL:
```
Forwarding: https://abc123.ngrok-free.app -> http://localhost:3001
```

### 3. Add Second Webhook Endpoint in Clerk

1. Go to Clerk Dashboard → Webhooks → Endpoints
2. Click **+ Add Endpoint** (again)
3. Fill in:
   ```
   Endpoint URL: https://abc123.ngrok-free.app/api/webhooks/clerk
   Description: Backend Sync (optional)
   ```
4. Subscribe to same events:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
5. Click **Create**
6. **Copy the Signing Secret** (different from Svix Play!)
7. Add to `.env.local`:
   ```env
   CLERK_WEBHOOK_SECRET=whsec_your_new_signing_secret
   ```

### 4. Test Complete Flow

1. Create a test user in Clerk Dashboard
2. Check **Svix Play**: See webhook payload
3. Check **Backend logs**: See sync confirmation
4. Check **Supabase**: User should be created!

---

## Understanding the Webhook Payload

When you view webhooks in Svix Play, here's what you'll see:

### user.created Event

```json
{
  "type": "user.created",
  "data": {
    "id": "user_2xxxxxxxxxxxxx",           // Clerk user ID
    "username": "john_doe",                 // Username (if set)
    "first_name": "John",                   // First name (if set)
    "last_name": "Doe",                     // Last name (if set)
    "email_addresses": [...],               // Email addresses
    "phone_numbers": [...],                 // Phone numbers
    "public_metadata": {                    // Custom metadata
      "role": "SALES_MANAGER_ROLE",
      "locations": ["Jakarta", "Surabaya"]
    },
    "private_metadata": {},
    "unsafe_metadata": {},
    "created_at": 1234567890000,
    "updated_at": 1234567890000,
    ...
  }
}
```

### Key Fields for Syncing

Your backend extracts:
- `data.id` → `clerk_id` in Supabase
- `data.username` → `name` in Supabase
- `data.public_metadata.role` → `role` in Supabase
- `data.public_metadata.locations` → `locations` in Supabase

---

## Troubleshooting with Svix Play

### Problem: No Webhooks Appearing

**Check**:
1. Is endpoint configured in Clerk?
2. Did you subscribe to the right events?
3. Try clicking "Test" in Clerk webhook settings
4. Check if webhook was sent (Clerk Dashboard → Webhooks → Logs)

### Problem: Webhook Shows but Backend Not Syncing

**This means**:
- ✅ Clerk webhooks are working
- ❌ Your backend has an issue

**Check**:
1. Is backend running?
2. Is ngrok tunnel active?
3. Is ngrok URL correct in Clerk?
4. Check backend logs for errors
5. Verify `CLERK_WEBHOOK_SECRET` is correct

### Problem: Different Data in Svix Play vs Backend

**Check**:
1. Compare the `public_metadata` in both
2. Ensure role/locations are set when creating user
3. Check if backend is reading correct fields
4. Verify backend extracts `public_metadata.role` and `public_metadata.locations`

---

## Production Setup

### Remove Svix Play in Production

Svix Play is for **development/debugging only**.

**In production**:
1. Remove the Svix Play endpoint from Clerk
2. Keep only your production backend endpoint
3. Use proper monitoring instead (logs, error tracking)

**Production endpoint example**:
```
https://api.yourdomain.com/api/webhooks/clerk
```

---

## Summary: Complete Workflow

### Development (with Svix Play):

```
Clerk User Event
    ↓
Clerk sends webhooks to BOTH:
    ├─→ Svix Play (debug) → You view in browser
    └─→ Your Backend (sync) → Syncs to Supabase
```

### Production (without Svix Play):

```
Clerk User Event
    ↓
Clerk sends webhook to:
    └─→ Your Backend (sync) → Syncs to Supabase
```

---

## Quick Start Checklist

**For Testing with Svix Play**:
- [ ] Add Svix Play endpoint to Clerk
- [ ] Subscribe to user events
- [ ] Create test user
- [ ] View webhook in Svix Play browser tab
- [ ] Inspect payload structure

**For Production Sync**:
- [ ] Start backend: `npm run server`
- [ ] Start ngrok: `ngrok http 3001`
- [ ] Add backend endpoint to Clerk
- [ ] Copy signing secret to `.env.local`
- [ ] Create test user
- [ ] Check backend logs
- [ ] Verify user in Supabase

---

## Resources

- **Your Svix Play URL**: https://play.svix.com/in/e_ERPzgFWqkB0IirmrLtBq7unn4az/
- [Svix Play Documentation](https://docs.svix.com/play)
- [Clerk Webhooks Guide](https://clerk.com/docs/guides/development/webhooks/syncing)
- [ngrok Setup](https://ngrok.com/docs/getting-started)

---

## Next Steps

1. **Try Svix Play First** (see webhooks):
   - Configure Svix Play URL in Clerk
   - Create test user
   - View webhook payload

2. **Then Add Backend** (sync to Supabase):
   - Start backend + ngrok
   - Add backend endpoint to Clerk
   - Test complete flow

3. **For Production**:
   - Deploy backend to public server
   - Remove Svix Play endpoint
   - Keep only production backend endpoint