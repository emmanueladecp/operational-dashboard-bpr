# Technical Architecture Overview

## System Overview

The Internal Operations Monitoring System is a full-stack React application designed for PT. Belitang Panen Raya's agricultural operations management. The system provides real-time monitoring of stock levels, sales analytics, purchase tracking, and comprehensive user management with role-based access control.

## Architecture Principles

### Design Philosophy
- **Separation of Concerns**: Clear boundaries between authentication, business logic, and data layers
- **Real-time Data Flow**: Live synchronization between frontend, backend, and database
- **Security First**: Multi-layer security with RLS policies and role-based access control
- **Scalable Architecture**: Modular design supporting future enhancements

### Core Architectural Patterns

#### 1. Frontend Architecture (React + TypeScript)
```
┌─────────────────────────────────────────────────────────┐
│                    React Application                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Routing   │  │   State     │  │   Components    │  │
│  │  (App.tsx)  │  │ Management  │  │   (Dashboard)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │     UI      │  │  Supabase   │  │     Clerk       │  │
│  │  Components │  │   Client    │  │  Integration    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 2. Backend Architecture (Node.js + Express)
```
┌─────────────────────────────────────────────────────────┐
│                   Express Server                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Webhook   │  │  User API   │  │   Health        │  │
│  │  Processing │  │ Endpoints   │  │   Checks        │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │    Svix     │  │   Clerk     │  │    Supabase     │  │
│  │  Webhook    │  │    SDK      │  │  Admin Client   │  │
│  │ Processing  │  │             │  │                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend Technologies
- **React 18.3.1**: Modern React with concurrent features and automatic batching
- **TypeScript 5.x**: Static type checking and enhanced developer experience
- **Vite 6.3.5**: Lightning-fast build tool with HMR and optimized production builds
- **Clerk**: Authentication and user management platform
- **Supabase Client**: Real-time database client with authentication integration

### Backend Technologies
- **Node.js**: JavaScript runtime for server-side development
- **Express.js 5.1.0**: Minimalist web framework for API development
- **Supabase**: Backend-as-a-Service providing PostgreSQL database and real-time features
- **Svix**: Webhook delivery platform for reliable event processing

### Database & Storage
- **PostgreSQL**: Relational database via Supabase
- **Row Level Security (RLS)**: Database-level access control policies
- **Real-time Subscriptions**: Live data updates using Supabase's real-time features

### UI/UX Technologies
- **Radix UI**: Headless UI component library (30+ components)
- **Tailwind CSS**: Utility-first CSS framework with custom green theme
- **Lucide React**: Beautiful icon library with consistent design
- **Recharts**: Composable charting library for data visualization

## Component Architecture

### Core Components

#### 1. Authentication Layer (`src/App.tsx`)
```typescript
// Authentication-based routing with Clerk
<SignedOut>
  <Login />
</SignedOut>
<SignedIn>
  <Dashboard />
</SignedIn>
```

**Responsibilities:**
- Route protection based on authentication state
- Conditional rendering of login vs dashboard views
- Integration with Clerk's authentication context

#### 2. Dashboard Component (`src/components/Dashboard.tsx`)
**Primary Responsibilities:**
- State management for user roles, locations, and stock data
- Real-time data fetching and processing
- Role-based UI rendering and access control
- Interactive data visualization and filtering

**Key State Variables:**
- `userRole`: Current user's role for access control
- `currentUserLocations`: Location IDs assigned to the user
- `stockData`: Raw stock information from database
- `processedStockData`: Aggregated and filtered stock data for display

#### 3. Supabase Integration (`src/lib/supabase.ts`)
**Design Pattern:** Singleton with Dependency Injection

```typescript
// Factory function creating authenticated Supabase clients
export function createClerkSupabaseClient(
  getToken: () => Promise<string | null>
): SupabaseClient {
  setClerkTokenGetter(getToken);
  return supabaseClient;
}
```

**Key Features:**
- Automatic token injection from Clerk sessions
- Centralized client configuration
- Backward compatibility with existing code

### UI Component Library (`src/components/ui/`)

**Architecture:** Radix UI + Tailwind CSS
- **30+ Reusable Components**: Buttons, dialogs, tables, forms, etc.
- **Consistent Design System**: Green theme with agricultural branding
- **Accessibility First**: Built on Radix UI primitives
- **Responsive Design**: Mobile-first approach with breakpoint management

## Data Flow Architecture

### Authentication Flow
```
1. User visits application
2. Clerk Provider initializes with publishable key
3. Unauthenticated users see Login component
4. Authenticated users receive JWT token
5. Token injected into Supabase client for authenticated requests
```

### Data Synchronization Flow
```
1. User action triggers database query
2. Supabase client includes Clerk token in Authorization header
3. RLS policies validate user permissions
4. Query results returned and processed by React components
5. Real-time subscriptions update UI automatically
```

### Webhook Processing Flow
```
1. User created/updated/deleted in Clerk Dashboard
2. Clerk sends webhook to configured endpoint
3. Svix verifies webhook signature
4. Express server processes event
5. Supabase admin client syncs data
6. Real-time subscriptions notify frontend
```

## Security Architecture

### Multi-Layer Security Approach

#### 1. Authentication Layer (Clerk)
- JWT token generation and validation
- Session management and automatic refresh
- Secure password policies and validation

#### 2. Database Layer (Supabase RLS)
- Row-level security policies based on user roles
- Location-based data filtering for sales roles
- Granular permissions for different user types

#### 3. Application Layer (React)
- Role-based component rendering
- Location-based data filtering
- Input validation and sanitization

### Role-Based Access Control Matrix

| Role | Stock Data | Sales Data | User Mgmt | Location Mgmt |
|------|------------|------------|-----------|---------------|
| SUPERADMIN | Full | Full | Full | Full |
| BOD | Full | Full | Read | Read |
| SALES_MANAGER | Location-based | Location-based | None | None |
| SALES_SUPERVISOR | Location-based | Location-based | None | None |
| AUDITOR | Read-only | Read-only | None | None |
| NO_ROLE | None | None | None | None |

## Performance Considerations

### Frontend Performance
- **Code Splitting**: Vite automatically splits code for optimal loading
- **Memoization**: `useMemo` hooks prevent unnecessary recalculations
- **Lazy Loading**: Components load on-demand
- **Caching**: React Query for server state management

### Backend Performance
- **Connection Pooling**: Supabase handles database connections efficiently
- **Webhook Deduplication**: Svix prevents duplicate event processing
- **Asynchronous Processing**: Non-blocking user operations

### Database Performance
- **Indexing**: Optimized queries with proper indexing strategy
- **Real-time Efficiency**: Supabase's real-time engine handles live updates
- **Query Optimization**: Aggregated queries for complex data processing

## Scalability Considerations

### Horizontal Scaling
- **Stateless Architecture**: Frontend and backend can scale independently
- **Database Scaling**: Supabase handles read replicas and connection pooling
- **CDN Integration**: Static assets served globally via optimized delivery

### Vertical Scaling
- **Resource Optimization**: Efficient memory usage and garbage collection
- **Database Optimization**: Query performance and index management
- **Caching Strategy**: Multi-level caching for improved response times

## Error Handling Strategy

### Error Types and Handling
- **Authentication Errors**: Handled by Clerk with automatic retry
- **Network Errors**: Graceful degradation with user feedback
- **Database Errors**: Transaction rollback and user notification
- **Validation Errors**: Client-side validation with server confirmation

### Monitoring and Logging
- **Browser Console**: Client-side error logging and debugging
- **Server Logs**: Express server error tracking and performance monitoring
- **Database Logs**: Supabase query performance and error tracking

## Future Enhancement Opportunities

### Technical Improvements
1. **Service Worker Implementation**: Offline functionality for mobile users
2. **Progressive Web App**: Enhanced mobile experience with app-like features
3. **Advanced Caching**: Redis integration for improved performance
4. **API Rate Limiting**: Protection against abuse and excessive usage

### Feature Enhancements
1. **Advanced Analytics**: Machine learning insights and predictive analytics
2. **Mobile Optimization**: Native mobile app development
3. **Multi-language Support**: Internationalization for global operations
4. **Advanced Reporting**: Custom report generation and export functionality

---

*This technical architecture document provides a comprehensive overview of the system's design principles, component interactions, and scalability considerations. It serves as a foundation for future development and maintenance activities.*