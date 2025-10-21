# Copilot Instructions for Operational Dashboard

## Project Overview
Internal operations monitoring system for PT. Belitang Panen Raya built with React, TypeScript, and Vite. Features real-time stock monitoring, sales analytics, and role-based access control.

## Key Architecture Patterns

### Authentication Flow
- Authentication via Clerk (`@clerk/clerk-react`)
- User state management in `src/App.tsx`
- Role-based routing using SignedIn/SignedOut guards

### Data Management
- Supabase for real-time data and PostgreSQL storage
- Row Level Security (RLS) policies control data access
- Location-based data filtering for sales roles
- Real-time sync between Clerk users and Supabase

### Component Structure
- UI components use Radix UI primitives with Tailwind CSS
- Common components in `src/components/ui/*`
- Business logic components in `src/components/*`
- Charts/visualizations use Recharts library

## Development Workflow

### Local Development
```bash
# Start development server
npm run dev        # Frontend at http://localhost:5173
npm run server     # Backend at http://localhost:3001
```

### Build Process
- Vite handles bundling with custom chunk splitting
- Production builds minified with Terser
- Android builds require additional Capacitor setup

## Critical Paths and Integration Points

### User Management
- User creation/updates handled by Clerk webhooks
- Role synchronization between Clerk and Supabase
- See `docs/USER_CREATION_SETUP.md` for flows

### Stock Management
- Real-time stock updates via Supabase subscriptions
- Location-specific inventory tracking
- Reference `docs/STOCK_TABLE_SETUP.md` for schema

### Mobile Support
- Android app build configuration in `android/`
- Capacitor handles native platform integration
- See `ANDROID_BUILD_README.md` for build steps

## Common Patterns

### State Management
- Use Clerk for auth state
- Supabase real-time subscriptions for data sync
- React Query for server state management

### Error Handling
- React Error Boundary wraps main components
- Consistent error UI components in `ui/alert.tsx`
- Backend errors logged via Express middleware

## File Organization
```
src/
├── components/     # React components
│   ├── ui/        # Reusable UI components
│   └── figma/     # Design system components
├── lib/           # Core utilities
├── hooks/         # Custom React hooks
└── utils/         # Helper functions
```

## Environment Setup
Required variables in `.env.local`:
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CLERK_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`