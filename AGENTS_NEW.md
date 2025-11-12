# AGENTS.md

**PT. Belitang Panen Raya - Operational Dashboard v1.0**  
Last Updated: 2025-11-06

---

## Project Snapshot

- **Type**: Single project (React frontend + Express backend + Supabase edge functions)
- **Stack**: React 18 + TypeScript (Vite), Express.js, Supabase, Clerk Auth, Capacitor (Android)
- **Architecture**: Hybrid (client-side + backend API + serverless edge functions)
- **Note**: Sub-folders have their own AGENTS.md files for detailed patterns

---

## Root Setup Commands

```bash
# Install dependencies
npm install

# Development (run both in separate terminals)
npm run dev      # Frontend dev server → http://localhost:3000
npm run server   # Express backend → http://localhost:3001

# Build
npm run build    # Output: build/

# Mobile
npx cap sync android        # Sync with Capacitor
npx cap open android        # Open in Android Studio
```

---

## Universal Conventions

**Code Style**:
- TypeScript for all new code
- Prettier/ESLint not configured (follow existing patterns)
- camelCase for variables/functions, PascalCase for components
- Use `@/` alias for absolute imports from `src/`

**Commits**:
- Descriptive commit messages
- Always co-author: `Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>`

**Branch Strategy**:
- Main branch: `master`
- No specific branch naming convention (direct commits common)

**PR Requirements**:
- Update `PROGRESS.md` before commit
- Verify `npm run build` succeeds
- Check git diff for secrets/credentials

---

## Security & Secrets

- ⚠️ **NEVER** commit `.env.local` (contains API keys)
- Secrets go in `.env.local` (frontend: `VITE_*`, backend: no prefix)
- Service role keys (`SUPABASE_SERVICE_ROLE_KEY`) are backend/edge ONLY
- Always use Svix signature verification for webhooks

**Required Environment Variables**:
```bash
# Frontend (public)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx

# Backend (private)
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
PORT=3001
```

---

## JIT Index - Directory Map

### Package Structure
- **Frontend App**: `src/` → [see src/AGENTS.md](src/AGENTS.md)
  - Main dashboard logic, React components, Clerk+Supabase integration
- **Edge Functions**: `supabase/functions/` → [see supabase/functions/AGENTS.md](supabase/functions/AGENTS.md)
  - Serverless Deno functions for stock sync and user management
- **Backend API**: `server.js` (single file)
  - Express server for user CRUD and webhook handling
- **Service Worker**: `public/sw.js` (single file)
  - PWA caching strategies
- **Documentation**: `technical_overview.md`, `PROGRESS.md`

### Quick Find Commands
```bash
# Find a React component
rg -n "export (default )?function" src/components --type tsx

# Find a hook
rg -n "export const use" src/ --type tsx

# Find API endpoints
rg -n "app\.(get|post|patch|delete)" server.js

# Find edge function
ls supabase/functions/*/index.ts

# Find UI component
ls src/components/ui/*.tsx

# Search all TypeScript
rg -n "pattern" src/ --type tsx --type ts
```

### Architecture Docs
- **System Overview**: `technical_overview.md` - Components, interactions, deployment
- **Progress Tracking**: `PROGRESS.md` - Timeline, completed features, bugs
- **Current File**: `AGENTS.md` - Agent architecture (legacy, verbose)

---

## Critical Patterns (Universal)

### ✅ DO
- **Supabase Client**: Use singleton from `src/lib/supabase.ts` (auto-injects Clerk JWT)
- **Absolute Imports**: Use `@/components/...` instead of `../../components/...`
- **Role Checks**: Use RLS policies in Supabase (roles: SUPERADMIN, BOD, SALES_MANAGER, etc.)
- **Error Handling**: Comprehensive try-catch blocks with user-friendly messages
- **Update PROGRESS.md**: Before every commit

### ❌ DON'T
- Create new Supabase clients (breaks JWT injection pattern)
- Use `SUPABASE_SERVICE_ROLE_KEY` in frontend (backend/edge only)
- Bypass RLS policies (except in backend/edge with service role)
- Skip `PROGRESS.md` updates
- Install new dependencies without discussion

---

## Definition of Done

**Pre-PR Checklist**:
- [ ] Code follows existing patterns (check similar files first)
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors in IDE
- [ ] `PROGRESS.md` updated with changes
- [ ] Git diff reviewed for secrets/credentials
- [ ] No new npm packages added

**Single Command Check**:
```bash
npm run build && echo "✅ Build successful"
```

---

## Quick Troubleshooting

**Backend won't start**:
```bash
# Check if port 3001 is in use
netstat -ano | findstr :3001
# Verify .env.local exists and has all required keys
cat .env.local
```

**Frontend build fails**:
```bash
# Clear cache and rebuild
rm -rf node_modules/.vite
npm run build
```

**Authentication issues**:
- Check Clerk dashboard for user roles and metadata
- Verify JWT token has correct claims (use jwt.io)
- Check Supabase RLS policies match role names

**Database access denied**:
- User must have correct role in Clerk public metadata
- RLS policies filter by JWT claims (`auth.jwt() ->> 'role'`)
- SALES roles need location assignments in metadata

---

## File Organization

```
📦 Root
├── 📂 src/                      # Frontend → [src/AGENTS.md]
├── 📂 supabase/functions/       # Edge functions → [supabase/functions/AGENTS.md]
├── 📄 server.js                 # Express backend
├── 📄 vite.config.ts            # Build config
├── 📄 .env.local                # Secrets (NOT committed)
├── 📄 technical_overview.md     # Architecture doc
├── 📄 PROGRESS.md               # Progress tracker
└── 📄 AGENTS.md                 # This file
```

---

**For detailed patterns, see sub-folder AGENTS.md files**:
- Frontend patterns: `src/AGENTS.md`
- Edge function patterns: `supabase/functions/AGENTS.md`
