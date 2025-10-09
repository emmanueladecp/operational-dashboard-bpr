
# Sistem Monitoring Operasional - PT. Belitang Panen Raya

A comprehensive internal operations monitoring system designed for agricultural/rice business operations management. This system provides real-time monitoring of stock levels, sales analytics, purchase tracking, and user management with role-based access control.

## 🌟 Features

### Core Functionality
- **📦 Stock Level Monitoring** - Real-time tracking of raw materials (BB) and finished goods (FG)
- **📊 Sales Analytics** - Interactive charts and visualizations with time period filtering
- **🛒 Purchase Analytics** - Purchase data tracking and supplier management
- **👥 User Management** - Role-based user administration (Super Admin only)
- **📍 Location Management** - Multi-location support with active/inactive status
- **🔐 Role-Based Access Control** - Different access levels for various user roles

### User Roles
- **Super Admin** - Full system access, user management, location management
- **BOD (Board of Directors)** - Executive-level access to all operational data
- **Sales Manager** - Access to sales data for assigned locations
- **Sales Supervisor** - Access to sales data for assigned locations
- **Auditor** - Read-only access to operational data
- **No Role** - Default role for new users

### Technical Features
- **Real-time Data Sync** - Automatic synchronization between Clerk and Supabase
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Interactive Charts** - Bar charts, pie charts, and data visualizations
- **Webhook Integration** - Automated user management workflows
- **Location-based Filtering** - Sales roles see only their assigned location data

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Clerk account ([dashboard.clerk.com](https://dashboard.clerk.com))
- Supabase project ([supabase.com](https://supabase.com))

### Installation

1. **Clone and install dependencies**
  ```bash
  git clone <repository-url>
  cd operational-dashboard-v1
  npm install
  ```

2. **Environment Setup**
  ```bash
  cp .env.example .env.local
  ```

  Update `.env.local` with your credentials:
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

3. **Start the backend server**
  ```bash
  npm run server
  ```
  Server will run on `http://localhost:3001`

4. **Start the frontend development server**
  ```bash
  npm run dev
  ```
  Application will be available at `http://localhost:5173`

## 📋 Setup Guides

For detailed setup instructions, refer to these guides:

- **[Quick Start Guide](docs/QUICK_START.md)** - Complete setup in 5 minutes
- **[Clerk & Supabase Integration](docs/CLERK_SUPABASE_INTEGRATION.md)** - Authentication setup
- **[Webhook Setup](docs/WEBHOOK_SETUP_GUIDE.md)** - Webhook configuration
- **[User Creation Setup](docs/USER_CREATION_SETUP.md)** - User management setup
- **[Stock Table Setup](docs/STOCK_TABLE_SETUP.md)** - Database schema setup

## 📚 Technical Documentation

For comprehensive technical information, see:

- **[Technical Architecture Overview](docs/TECHNICAL_ARCHITECTURE.md)** - System design and architecture patterns
- **[Component Architecture Deep Dive](docs/COMPONENT_ARCHITECTURE.md)** - Detailed component design and interactions
- **[Deployment Architecture Guide](docs/DEPLOYMENT_ARCHITECTURE.md)** - Build processes, environments, and deployment strategies
- **[API Reference Documentation](docs/API_REFERENCE.md)** - Complete API endpoint documentation
- **[Edge Function Setup](docs/EDGE_FUNCTION_SETUP.md)** - Serverless function deployment and configuration
- **[RLS Implementation Guide](docs/RLS_IMPLEMENTATION_GUIDE.md)** - Row Level Security setup and troubleshooting
- **[Next Steps](docs/NEXT_STEPS.md)** - Implementation roadmap and remaining tasks
- **[Svix Play Setup](docs/SVIX_PLAY_SETUP.md)** - Webhook testing and debugging guide

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/REST    ┌──────────────────┐
│   React Frontend│◄──────────────► │  Express Server  │
│   (Vite + TS)   │                 │  (Node.js)       │
└─────────────────┘                 └──────────────────┘
        │                                      │
        │                                      │
        ▼                                      ▼
┌─────────────────┐                 ┌──────────────────┐
│     Clerk       │                 │    Supabase      │
│  Authentication │                 │   PostgreSQL     │
└─────────────────┘                 └──────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite (build tool)
- Clerk (authentication)
- Radix UI + Tailwind CSS (UI components)
- Recharts (data visualization)
- React Hook Form (form handling)

**Backend:**
- Express.js server
- Supabase (database & real-time features)
- Clerk SDK (user management)
- Svix (webhook processing)

**Database:**
- PostgreSQL (via Supabase)
- Row Level Security (RLS) policies
- Real-time subscriptions

## 🎯 Usage

### For Super Admins
1. **User Management** - Create, edit, and delete users with role assignments
2. **Location Management** - Add/edit operational locations
3. **Full Data Access** - View all stock, sales, and purchase data
4. **System Configuration** - Manage roles and permissions

### For Sales Managers/Supervisors
1. **Location-Specific Data** - View data only for assigned locations
2. **Sales Analytics** - Monitor sales performance and trends
3. **Stock Monitoring** - Track inventory levels for assigned locations

### For BOD (Board of Directors)
1. **Executive Dashboard** - High-level operational overview
2. **Performance Metrics** - Key performance indicators
3. **Strategic Insights** - Data for decision-making

### For Auditors
1. **Read-Only Access** - View operational data without modification rights
2. **Compliance Monitoring** - Track system usage and data integrity

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run server   # Start backend server
npm run preview  # Preview production build
```

### Project Structure

```
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components (30+ components)
│   │   ├── Dashboard.tsx   # Main dashboard component (1,685 lines)
│   │   └── Login.tsx       # Authentication component
│   ├── lib/
│   │   └── supabase.ts     # Supabase client with Clerk integration
│   └── styles/             # Global styles
├── supabase/
│   └── functions/          # Edge functions (create-user)
├── docs/                   # Comprehensive documentation
│   ├── TECHNICAL_ARCHITECTURE.md    # System design overview
│   ├── COMPONENT_ARCHITECTURE.md    # Component design deep dive
│   ├── DEPLOYMENT_ARCHITECTURE.md   # Deployment and infrastructure
│   ├── API_REFERENCE.md             # Complete API documentation
│   ├── *.md                         # Setup and configuration guides
├── server.js               # Express backend server
└── README.md               # This file
```

## 🔒 Security Features

- **Row Level Security (RLS)** - Database-level access control
- **Role-Based Access Control (RBAC)** - Application-level permissions
- **Webhook Signature Verification** - Secure webhook processing
- **Environment Variable Protection** - Sensitive data protection
- **CORS Configuration** - Cross-origin request handling

## 🚨 Troubleshooting

### Common Issues

**Backend server won't start:**
- Ensure all environment variables are set correctly
- Check if port 3001 is available
- Verify Node.js version compatibility

**Authentication issues:**
- Confirm Clerk keys are correct
- Check webhook configuration in Clerk dashboard
- Verify user roles are properly assigned

**Database connection errors:**
- Validate Supabase URL and keys
- Check RLS policies are correctly configured
- Ensure database tables exist

**Data not loading:**
- Check browser console for errors
- Verify Supabase real-time is enabled
- Confirm user has proper role permissions

## 📞 Support

For technical support or questions:
1. Check the troubleshooting section above
2. Review the setup guides in the documentation
3. Check backend server logs for detailed error messages
4. Verify all environment variables are correctly configured

## 📄 License

This project is proprietary software for PT. Belitang Panen Raya.

---

**Version:** 1.0.0
**Last Updated:** 2025

## 📖 Documentation Overview

This project now includes comprehensive documentation organized into two main categories:

### 🚀 Setup & Configuration (`docs/`)
- **Quick Start Guide** - Get up and running in 5 minutes
- **Clerk & Supabase Integration** - Authentication and database setup
- **Webhook Setup** - Automated user synchronization
- **User Creation Setup** - User management workflows
- **Stock Table Setup** - Database schema and sample data
- **Edge Function Setup** - Serverless function deployment
- **RLS Implementation** - Row Level Security configuration
- **Svix Play Setup** - Webhook testing and debugging

### 🏗️ Technical Architecture (`docs/`)
- **Technical Architecture Overview** - System design and technology stack
- **Component Architecture Deep Dive** - Detailed component analysis
- **Deployment Architecture Guide** - Infrastructure and deployment strategies
- **API Reference Documentation** - Complete API endpoint documentation

All documentation is continuously updated to reflect the current state of the system and provides both high-level overviews and detailed technical specifications for developers and system administrators.