# AGENTS.md Hierarchical Migration Summary

**Date**: 2025-11-06  
**Task**: Rework existing AGENTS.md into hierarchical JIT structure

---

## What Was Created

### 1. Root AGENTS.md (NEW)
**File**: `AGENTS_NEW.md` (temporary filename - rename to replace old AGENTS.md)  
**Size**: ~170 lines (vs 1,610 lines in old AGENTS.md)  
**Token Reduction**: ~90% reduction in root file size

**Contents**:
- Project snapshot (type, stack)
- Root setup commands (dev, build, mobile)
- Universal conventions (code style, commits, security)
- JIT Index with links to sub-files
- Quick find commands
- Critical patterns (DO/DON'T)
- Definition of Done
- Quick troubleshooting

**Philosophy**: Lightweight, links to detailed sub-files, JIT hints instead of full content

---

### 2. Frontend AGENTS.md
**File**: `src/AGENTS.md` (NEW)  
**Size**: ~120 lines (focused)

**Contents**:
- Package identity (React + TypeScript)
- Setup & run commands
- Patterns & conventions:
  - File organization
  - ⭐ Supabase singleton pattern (critical)
  - Absolute imports with `@/` alias
  - State management patterns
  - Auth patterns
- Touch points (key files)
- JIT index hints (ripgrep commands)
- Common gotchas (4 critical items)
- Pre-PR checks

**Focus**: Supabase singleton pattern, absolute imports, role-based access

---

### 3. Edge Functions AGENTS.md
**File**: `supabase/functions/AGENTS.md` (NEW)  
**Size**: ~150 lines

**Contents**:
- Package identity (Deno runtime)
- Setup & deployment commands
- Patterns & conventions:
  - Function structure
  - Deno-specific imports (`npm:` specifiers)
  - CORS handling (required)
- Touch points (stock sync, user management)
- JIT index hints
- Common gotchas (5 critical items)
- Pre-deploy checks
- Example: Adding new edge function

**Focus**: Deno patterns, CORS, service role key usage

---

## Migration Plan

### Step 1: Backup Current AGENTS.md
```bash
mv AGENTS.md AGENTS_OLD.md
```

### Step 2: Activate New Root AGENTS.md
```bash
mv AGENTS_NEW.md AGENTS.md
```

### Step 3: Sub-files Are Already in Place
- `src/AGENTS.md` ✅
- `supabase/functions/AGENTS.md` ✅

### Step 4: Update Links (if needed)
- Root AGENTS.md links to sub-files: `[see src/AGENTS.md](src/AGENTS.md)`
- All links use relative paths

### Step 5: Test Agent Navigation
1. Open root AGENTS.md
2. Click link to src/AGENTS.md
3. Click link to supabase/functions/AGENTS.md
4. Verify all paths work

---

## Key Improvements

### Token Efficiency
| File | Old Size | New Size | Reduction |
|------|----------|----------|-----------|
| Root AGENTS.md | 1,610 lines | ~170 lines | 90% |
| Total system | 1,610 lines | ~440 lines | 73% |

**Why This Matters**:
- AI agents load nearest AGENTS.md file
- Smaller files = faster context loading
- JIT hints (commands) instead of full content

### Nearest-Wins Hierarchy
```
operational_dashboard_v1/
├── AGENTS.md                     # Root (universal guidance)
├── src/
│   ├── AGENTS.md                 # Frontend patterns (nearest wins)
│   ├── components/
│   │   └── Dashboard.tsx         # Uses src/AGENTS.md
│   └── lib/
│       └── supabase.ts           # Uses src/AGENTS.md
└── supabase/functions/
    ├── AGENTS.md                 # Edge function patterns (nearest wins)
    ├── sync-stock/
    │   └── index.ts              # Uses supabase/functions/AGENTS.md
    └── create-user/
        └── index.ts              # Uses supabase/functions/AGENTS.md
```

### JIT (Just-In-Time) Indexing
**Before** (old AGENTS.md):
```markdown
## Agent 1: Webhook Synchronization
[... 100 lines of documentation ...]

## Agent 2: User Management
[... 100 lines of documentation ...]
```

**After** (new structure):
```markdown
## JIT Index
- Frontend: `src/` → [see src/AGENTS.md](src/AGENTS.md)
- Edge Functions: `supabase/functions/` → [see supabase/functions/AGENTS.md](supabase/functions/AGENTS.md)

## Quick Find
```bash
# Find component
rg -n "export function" src/components --type tsx
```
```

**Benefit**: Agent gets command to find what they need, not all the content upfront

---

## What Was Preserved

### From Old AGENTS.md
1. **Critical patterns** (Supabase singleton, dual-write, RLS)
2. **Security guidelines** (never commit secrets, service role key usage)
3. **Agent architecture** (webhook, user management, stock sync)
4. **Role-based access** (6 roles, location filtering)

### Moved to Sub-Files
- **Frontend patterns** → `src/AGENTS.md`
- **Edge function patterns** → `supabase/functions/AGENTS.md`
- **Detailed examples** → Closer to actual code

### Linked, Not Duplicated
- `technical_overview.md` for architecture details
- `PROGRESS.md` for project timeline
- No duplication between root and sub-files

---

## Validation Checklist

- [x] Root AGENTS.md under 200 lines ✅ (170 lines)
- [x] Root links to all sub-AGENTS.md files ✅
- [x] Each sub-file has concrete examples (actual file paths) ✅
- [x] Commands are copy-paste ready ✅
- [x] No duplication between root and sub-files ✅
- [x] JIT hints use actual patterns (ripgrep, find) ✅
- [x] Every "✅ DO" has a real file example ✅
- [x] Every "❌ DON'T" references a real anti-pattern ✅
- [x] Pre-PR checks are single copy-paste commands ✅

---

## Usage Examples

### Example 1: Agent Needs to Add a React Component

**Old way**: Read all 1,610 lines of AGENTS.md

**New way**:
1. Agent is working in `src/components/NewComponent.tsx`
2. Agent reads nearest `src/AGENTS.md` (120 lines)
3. Sees ⭐ critical pattern: Use Supabase singleton
4. Sees example: `src/components/Dashboard.tsx`
5. Uses JIT hint: `rg -n "createClerkSupabaseClient" src/`
6. Copies pattern correctly

**Token savings**: 1,490 lines not loaded

---

### Example 2: Agent Needs to Deploy Edge Function

**Old way**: Read all 1,610 lines of AGENTS.md

**New way**:
1. Agent is working in `supabase/functions/new-function/index.ts`
2. Agent reads nearest `supabase/functions/AGENTS.md` (150 lines)
3. Sees pattern: Use `npm:` imports for Deno
4. Sees example: `sync-stock/index.ts`
5. Copies deployment command: `npx supabase functions deploy ...`

**Token savings**: 1,460 lines not loaded

---

### Example 3: Agent Needs to Understand Overall Architecture

**Old way**: Read all 1,610 lines of AGENTS.md

**New way**:
1. Agent reads root `AGENTS.md` (170 lines)
2. Gets project snapshot, directory map
3. If needs more detail, clicks link to `technical_overview.md`
4. If needs frontend details, clicks link to `src/AGENTS.md`

**Token savings**: Lazy loading, reads only what's needed

---

## Next Steps

1. **Test the new structure** with actual agent tasks
2. **Monitor token usage** (should be significantly lower)
3. **Iterate based on feedback** (add more JIT hints if needed)
4. **Keep files under 200 lines** (root) and 250 lines (sub-files)
5. **Update PROGRESS.md** with this migration

---

## Rollback Plan (If Needed)

If the new structure doesn't work:

```bash
# Restore old AGENTS.md
mv AGENTS.md AGENTS_NEW_BACKUP.md
mv AGENTS_OLD.md AGENTS.md

# Remove sub-files
rm src/AGENTS.md
rm supabase/functions/AGENTS.md
```

But we believe the new structure will be more efficient! 🚀

---

**Questions or Issues?**
- Compare token usage before/after
- Check if agents can find patterns quickly
- Validate JIT hints actually return useful results
