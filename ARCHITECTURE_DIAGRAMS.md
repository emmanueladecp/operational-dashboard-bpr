# Architecture Diagrams
**Belitang Operational Dashboard**  
Visual Architecture Reference

---

## 1. System Overview Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (Browser/Mobile)                │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   React      │  │   Service    │  │    Clerk     │  │ Capacitor│ │
│  │   PWA        │◄─┤   Worker     │  │   Auth       │  │  (Mobile)│ │
│  │ (Dashboard)  │  │  (Caching)   │  │  (JWT)       │  │   Wrapper│ │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘  └──────────┘ │
│         │                                     │                       │
└─────────┼─────────────────────────────────────┼───────────────────────┘
          │                                     │
          │ HTTPS/REST                          │ JWT Token
          │                                     │
┌─────────┼─────────────────────────────────────┼───────────────────────┐
│         ▼                                     ▼                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Express    │  │   Supabase   │  │    Clerk     │              │
│  │   Backend    │  │     Edge     │  │     API      │              │
│  │   (Node.js)  │  │  Functions   │  │  (User Mgmt) │              │
│  │              │  │   (Deno)     │  │              │              │
│  │ • User CRUD  │  │ • Stock Sync │  │ • Auth       │              │
│  │ • Webhooks   │  │ • User API   │  │ • Metadata   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
│         │  Admin API       │  Service Role    │  API                 │
│         ▼                  ▼                  ▼                       │
│  ┌──────────────────────────────────────────────────────┐           │
│  │            Supabase (PostgreSQL)                      │           │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │           │
│  │  │   Tables   │  │    RLS     │  │ Real-time  │     │           │
│  │  │  (7 core)  │  │  Policies  │  │   Subs     │     │           │
│  │  └────────────┘  └────────────┘  └────────────┘     │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                       │
│                          DATA SOURCES                                │
│  ┌──────────────────────────────────────────────────────┐           │
│  │         iDempiere ERP API (External)                 │           │
│  │         • Stock data                                  │           │
│  │         • Product master                              │           │
│  └──────────────────────────────────────────────────────┘           │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication Flow

```
┌─────────────┐
│   User      │
│ (Browser)   │
└──────┬──────┘
       │ 1. Navigate to /
       ▼
┌─────────────────┐
│  Clerk Check    │
│ Authenticated?  │
└────┬────────────┘
     │
     ├─── NO ──→ ┌──────────────┐
     │           │ Login Page   │
     │           │ (Clerk UI)   │
     │           └──────┬───────┘
     │                  │ 2. Enter credentials
     │                  ▼
     │           ┌──────────────┐
     │           │ Clerk API    │
     │           │ Validates    │
     │           └──────┬───────┘
     │                  │ 3. Success
     │                  ▼
     │           ┌──────────────┐
     │           │ Issue JWT    │
     │           │ Token with:  │
     │           │ - user_id    │
     │           │ - role       │
     │           │ - locations  │
     │           └──────┬───────┘
     │                  │
     └── YES ──────────┘
                        │ 4. Token stored in session
                        ▼
                 ┌──────────────┐
                 │  Dashboard   │
                 │  Component   │
                 └──────┬───────┘
                        │ 5. Token injected in headers
                        ▼
                 ┌──────────────┐
                 │  Supabase    │
                 │  Client      │
                 └──────┬───────┘
                        │ 6. Custom fetch with JWT
                        ▼
                 ┌──────────────┐
                 │  Supabase    │
                 │  Database    │
                 │  (RLS Check) │
                 └──────┬───────┘
                        │ 7. Filtered data by role
                        ▼
                 ┌──────────────┐
                 │  Dashboard   │
                 │  Renders     │
                 └──────────────┘
```

---

## 3. User Management Flow

```
┌──────────────────────────────────────────────────────────────┐
│  SUPERADMIN Dashboard                                         │
│  ┌──────────────┐                                            │
│  │ Create User  │ → Fill Form (username, password, role,     │
│  │   Button     │   locations)                               │
│  └──────┬───────┘                                            │
└─────────┼────────────────────────────────────────────────────┘
          │ 1. POST /api/users/create
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Express Backend (server.js)                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Validate Input (password, username, role)          │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 2. Valid                                        │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Try: Create User in Clerk                          │    │
│  │  clerkClient.users.createUser({                     │    │
│  │    username, password,                              │    │
│  │    publicMetadata: { role, locations }              │    │
│  │  })                                                  │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 3. Success → clerk_id                          │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Try: Insert into Supabase users table              │    │
│  │  supabaseAdmin.from('users').insert({               │    │
│  │    clerk_id, name, username, role, locations        │    │
│  │  })                                                  │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │                                                 │
│            ├─── SUCCESS ──→ 4. Return user object           │
│            │                                                 │
│            └─── FAIL ──→ ┌─────────────────────────────┐    │
│                          │  Rollback: Delete from Clerk │    │
│                          │  clerkClient.users.deleteUser│    │
│                          └──────┬──────────────────────┘    │
│                                 │ 5. Return error           │
└─────────────────────────────────┼───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Async Webhook (Clerk → Backend)                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Clerk sends webhook: user.created                   │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 6. POST /api/webhooks/clerk                    │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Verify Svix signature                              │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 7. Valid                                        │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Upsert into Supabase (idempotent)                  │    │
│  │  • If exists: Update                                │    │
│  │  • If not: Insert                                   │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 8. Return 200 OK                               │
└────────────┼─────────────────────────────────────────────────┘
             ▼
      ┌──────────────┐
      │  Sync        │
      │  Complete    │
      └──────────────┘
```

---

## 4. Stock Synchronization Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Trigger (Manual or Scheduled)                                │
│  ┌──────────────┐                                            │
│  │  Dashboard   │ Click "Sync Stock" Button                  │
│  │  or Cron Job │                                            │
│  └──────┬───────┘                                            │
└─────────┼────────────────────────────────────────────────────┘
          │ 1. POST /functions/v1/sync-stock
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Edge Function (sync-stock)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Step 1: Fetch from External API                    │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ GET https://ibpr.berasraja.com/api/v1/       │  │    │
│  │  │     models/mvw_dashboard_storage_per_product  │  │    │
│  │  │     _onlyrm                                   │  │    │
│  │  │ Headers: Authorization: Bearer <API_KEY>      │  │    │
│  │  └───────────┬───────────────────────────────────┘  │    │
│  │              │ 2. Response with stock records        │    │
│  │              ▼                                        │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ Step 2: Validate & Transform                  │  │    │
│  │  │ For each record:                              │  │    │
│  │  │   - Check location exists in master_locations │  │    │
│  │  │   - Skip if location not mapped               │  │    │
│  │  │   - Transform external → internal schema      │  │    │
│  │  │   - Add to stockRecords array                 │  │    │
│  │  └───────────┬───────────────────────────────────┘  │    │
│  │              │ 3. Valid records prepared             │    │
│  │              ▼                                        │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ Step 3: Database Transaction                  │  │    │
│  │  │ BEGIN TRANSACTION                             │  │    │
│  │  │   1. DELETE FROM stock                        │  │    │
│  │  │      WHERE product_type IN                    │  │    │
│  │  │      ('RAW MATERIAL', 'FINISHED_GOODS')       │  │    │
│  │  │                                               │  │    │
│  │  │   2. INSERT INTO stock (batch)                │  │    │
│  │  │      VALUES (stockRecords array)              │  │    │
│  │  │ COMMIT                                        │  │    │
│  │  └───────────┬───────────────────────────────────┘  │    │
│  │              │ 4. Success                            │    │
│  │              ▼                                        │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ Step 4: Return Summary                        │  │    │
│  │  │ {                                             │  │    │
│  │  │   success: true,                              │  │    │
│  │  │   records_processed: 25,                      │  │    │
│  │  │   records_inserted: 25                        │  │    │
│  │  │ }                                             │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │ 5. Response to client
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Auto-refresh stock data via useEffect              │    │
│  │  - Fetch updated stock from Supabase                │    │
│  │  - Apply RLS filters                                │    │
│  │  - Update UI with new data                          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Data Access with RLS

```
┌──────────────────────────────────────────────────────────────┐
│  User Query (e.g., fetch stock data)                         │
│  ┌──────────────┐                                            │
│  │  Dashboard   │ supabaseClient.from('stock').select()      │
│  └──────┬───────┘                                            │
└─────────┼────────────────────────────────────────────────────┘
          │ 1. HTTP Request with JWT token in header
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase REST API                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Extract JWT token from Authorization header        │    │
│  │  Parse token claims:                                │    │
│  │    - user_id                                        │    │
│  │    - role (e.g., "SALES_MANAGER_ROLE")             │    │
│  │    - locations (e.g., [1, 2, 3])                   │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 2. Token validated                             │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  PostgreSQL RLS Policy Evaluation                   │    │
│  │                                                      │    │
│  │  Policy: sales_role_location_access                 │    │
│  │  FOR SELECT ON stock                                │    │
│  │  USING (                                            │    │
│  │    -- Check role                                    │    │
│  │    auth.jwt() ->> 'role' IN (                       │    │
│  │      'SALES_MANAGER_ROLE',                          │    │
│  │      'SALES_SUPERVISOR_ROLE'                        │    │
│  │    )                                                │    │
│  │    AND                                              │    │
│  │    -- Check location access                         │    │
│  │    m_location_id = ANY(                             │    │
│  │      SELECT unnest(                                 │    │
│  │        CAST(auth.jwt() ->> 'locations' AS int[])    │    │
│  │      )                                              │    │
│  │    )                                                │    │
│  │  )                                                  │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 3. Policy applied to query                     │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Execute Query with RLS Filter                      │    │
│  │  SELECT * FROM stock                                │    │
│  │  WHERE (RLS policy conditions)                      │    │
│  │    AND (user query conditions)                      │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 4. Filtered results                            │
└────────────┼─────────────────────────────────────────────────┘
             │ 5. Return JSON response
             ▼
┌──────────────────────────────────────────────────────────────┐
│  Dashboard                                                    │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Receive filtered data                              │     │
│  │  • SUPERADMIN → All locations                       │     │
│  │  • BOD → All locations                              │     │
│  │  • SALES_MANAGER → Locations [1, 2, 3] only        │     │
│  │  • SALES_SUPERVISOR → Locations [1, 2, 3] only     │     │
│  │  • AUDITOR → All locations (read-only)             │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Service Worker Caching Strategy

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (Main Thread)                                        │
│  ┌──────────────┐                                            │
│  │  React App   │ fetch('/api/stock')                        │
│  └──────┬───────┘                                            │
└─────────┼────────────────────────────────────────────────────┘
          │ 1. Network request
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Service Worker (sw.js)                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Intercept Fetch Event                              │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 2. Determine caching strategy by URL/type      │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Strategy Selection:                                │    │
│  │                                                      │    │
│  │  IF URL matches:                                    │    │
│  │    /api/*        → Network First                    │    │
│  │    *.png, *.jpg  → Cache First                      │    │
│  │    *.js, *.css   → Cache First                      │    │
│  │    *.html        → Stale While Revalidate           │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 3. Apply selected strategy                     │
└────────────┼─────────────────────────────────────────────────┘
             │
             ├─── NETWORK FIRST (API Calls) ───────────────┐
             │                                              │
             │  ┌────────────────────────────────────────┐  │
             │  │ 1. Try network request                 │  │
             │  └────┬───────────────────────────────────┘  │
             │       │                                      │
             │       ├─── SUCCESS ──→ Cache response       │
             │       │                Return response      │
             │       │                                      │
             │       └─── FAIL ──→ Check cache             │
             │                      Return cached          │
             │                      or 503 error           │
             │                                              │
             ├─── CACHE FIRST (Static Assets) ─────────────┤
             │                                              │
             │  ┌────────────────────────────────────────┐  │
             │  │ 1. Check cache                         │  │
             │  └────┬───────────────────────────────────┘  │
             │       │                                      │
             │       ├─── HIT ──→ Return cached response   │
             │       │                                      │
             │       └─── MISS ──→ Fetch from network      │
             │                      Cache response         │
             │                      Return response        │
             │                                              │
             └─── STALE WHILE REVALIDATE (HTML) ───────────┤
                                                            │
                ┌────────────────────────────────────────┐  │
                │ 1. Return cached response immediately  │  │
                │ 2. Fetch fresh copy in background     │  │
                │ 3. Update cache for next request      │  │
                └────────────────────────────────────────┘  │
                                                            │
          ┌─────────────────────────────────────────────────┘
          │ 4. Response (from cache or network)
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Browser (Main Thread)                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  React App receives response                        │    │
│  │  Update UI with data                                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE SCHEMA                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│     users        │
├──────────────────┤
│ id (PK)          │
│ clerk_id (UK)    │───┐ Referenced by JWT token
│ name             │   │ for RLS policy evaluation
│ username (UK)    │   │
│ role             │◄──┘
│ locations (int[])│◄──┐
│ created_at       │   │
│ updated_at       │   │
└──────────────────┘   │
                       │ Foreign Key
                       │ (conceptual, not enforced)
                       │
┌──────────────────┐   │
│ master_locations │◄──┘
├──────────────────┤
│ m_location_id(PK)│───┐
│ name             │   │ Referenced by
│ address          │   │ multiple tables
│ city             │   │
│ is_active        │   │
│ created_at       │   │
│ updated_at       │   │
└──────────────────┘   │
                       │
        ┌──────────────┴──────────────────────┐
        │                                      │
        │                                      │
┌───────▼──────────┐  ┌──────────────────┐   │
│     stock        │  │ production_recap │   │
├──────────────────┤  ├──────────────────┤   │
│ id (PK)          │  │ id (PK)          │   │
│ m_location_id(FK)│  │ m_location_id(FK)│   │
│ location         │  │ location         │   │
│ m_product_id     │  │ period (YYYY-MM) │   │
│ name             │  │ product_id       │   │
│ quantity         │  │ product_name     │   │
│ uom_name         │  │ quantity         │   │
│ product_type     │  │ category         │   │
│ category         │  │ created_at       │   │
│ created_at       │  │ updated_at       │   │
│ updated_at       │  └──────────────────┘   │
└──────────────────┘                         │
                                              │
┌──────────────────────┐  ┌─────────────────▼──┐
│production_recap_gabah│  │      sales         │
├──────────────────────┤  ├────────────────────┤
│ id (PK)              │  │ id (PK)            │
│ m_location_id (FK)   │  │ m_location_id (FK) │
│ location             │  │ location           │
│ period (YYYY-MM)     │  │ period_date (DATE) │
│ product_id           │  │ product_id         │
│ product_name         │  │ product_name       │
│ quantity             │  │ quantity           │
│ created_at           │  │ category           │
│ updated_at           │  │ created_at         │
└──────────────────────┘  │ updated_at         │
                          └────────────────────┘
                                  
                          ┌────────────────────┐
                          │    pembelian       │
                          ├────────────────────┤
                          │ id (PK)            │
                          │ m_location_id (FK) │
                          │ location           │
                          │ periode_date (DATE)│
                          │ product_id         │
                          │ product_name       │
                          │ movementqty        │
                          │ priceharian        │
                          │ subtotal           │
                          │ category_id        │
                          │ category_name      │
                          │ created_at         │
                          │ updated_at         │
                          └────────────────────┘

Legend:
  PK = Primary Key
  FK = Foreign Key
  UK = Unique Key
  ──┐ = Relationship (conceptual or enforced)
  ◄──┘
```

---

## 8. Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                              │
│                     (Root Component)                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼──────────┐        ┌───────────▼──────────┐
│   ClerkProvider  │        │   React Router       │
│   (Auth Context) │        │   (Future)           │
└───────┬──────────┘        └──────────────────────┘
        │
        ├─── Not Authenticated ──→ Login.tsx
        │                          └─ ClerkSignIn
        │
        └─── Authenticated ──────→ Dashboard.tsx
                                   │
                ┌──────────────────┴───────────────────┐
                │                                      │
      ┌─────────▼──────────┐            ┌─────────────▼────────┐
      │  Tabs Component    │            │  Quick Stats Cards   │
      │  (Navigation)      │            │  (6 metrics)         │
      └─────────┬──────────┘            └──────────────────────┘
                │
      ┌─────────┼──────────────────┐
      │         │                  │
┌─────▼─────────▼───┐  ┌──────────▼──────────┐
│ Level Stok BB/FG  │  │ Produksi FG/Gabah   │
│ (Stock Tables)    │  │ (Production Stats)  │
│ - Search          │  │ - ProductionRecap   │
│ - Filter          │  │ - ProductionRecapGa │
│ - Detail Modal    │  │   bah               │
└───────────────────┘  └─────────────────────┘
                                  
┌───────────────────┐  ┌──────────────────────┐
│ Data Penjualan    │  │ Management User      │
│ (Sales Data)      │  │ (SUPERADMIN only)    │
│ - Period Filter   │  │ - User Table         │
│ - Location Filter │  │ - Create User Dialog │
└───────────────────┘  │ - Edit User Dialog   │
                       │ - Delete Confirm     │
┌───────────────────┐  └──────────────────────┘
│ Data Pembelian    │
│ (Purchase Data)   │  ┌──────────────────────┐
│ - Period Filter   │  │ Management Lokasi    │
│ - Price Display   │  │ (Location Admin)     │
└───────────────────┘  │ - Location Table     │
                       │ - Status Toggle      │
                       └──────────────────────┘

UI Components (shadcn/ui):
├─ Button
├─ Card
├─ Table
├─ Dialog
├─ Select
├─ Input
├─ Badge
├─ Tabs
└─ ... (50+ components)
```

---

## 9. Deployment Pipeline (Future)

```
┌─────────────────────────────────────────────────────────────┐
│  Development Workflow                                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Developer   │
│  (Local)     │
└──────┬───────┘
       │ 1. Code changes
       │ 2. npm run dev (test locally)
       │ 3. npm run build (verify build)
       ▼
┌──────────────┐
│  Git Push    │
│  to GitHub   │
└──────┬───────┘
       │ 4. Push to master branch
       ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions (CI/CD Pipeline)                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Stage 1: Lint & Type Check                         │    │
│  │  - npm run lint (eslint)                            │    │
│  │  - tsc --noEmit (type check)                        │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 5. Pass                                         │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Stage 2: Build & Test                              │    │
│  │  - npm run build                                    │    │
│  │  - npm run test (future)                            │    │
│  └─────────┬───────────────────────────────────────────┘    │
│            │ 6. Pass                                         │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Stage 3: Deploy                                    │    │
│  │  - Deploy to Vercel (frontend)                      │    │
│  │  - Restart Express server (backend)                 │    │
│  │  - Deploy edge functions (Supabase)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
       │ 7. Deployment complete
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Production Environment                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Vercel     │  │ Express API  │  │ Edge Funcs   │      │
│  │  (Frontend)  │  │  (Backend)   │  │ (Supabase)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────┘
       │ 8. Live to users
       ▼
┌──────────────┐
│    Users     │
│  (Browser/   │
│   Mobile)    │
└──────────────┘
```

---

**End of Architecture Diagrams**

For more details, see:
- **PRESENTATION.md** - Comprehensive system overview
- **technical_overview.md** - Component interactions
- **AGENTS.md** - Agent architecture details
