# Deployment Architecture Guide

## Overview

This document outlines the deployment architecture, build processes, environment configurations, and operational procedures for the Internal Operations Monitoring System.

## Architecture Overview

### Deployment Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        Deployment Environments                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │  Development │  │   Staging    │  │    Production       │    │
│  │  (localhost) │  │  (staging.*) │  │  (app.*)            │    │
│  └──────────────┘  └──────────────┘  └─────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │  Frontend    │  │   Backend    │  │    Database         │    │
│  │  (Vite)      │  │  (Express)   │  │  (Supabase)         │    │
│  └──────────────┘  └──────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Build System Architecture

### Frontend Build Process (Vite)

#### Development Build
```bash
npm run dev
# Starts Vite dev server on http://localhost:5173
# Features: Hot Module Replacement, Fast Refresh, Source Maps
```

**Build Configuration (`vite.config.ts`):**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true // Allows external connections
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-accordion', '@radix-ui/react-dialog'],
          supabase: ['@supabase/supabase-js'],
          clerk: ['@clerk/clerk-react']
        }
      }
    }
  }
})
```

#### Production Build
```bash
npm run build
# Outputs to /dist directory
# Features: Code splitting, Tree shaking, Asset optimization
```

**Build Output Structure:**
```
dist/
├── assets/
│   ├── index.css
│   ├── index.js
│   └── vendor.[hash].js
├── index.html
└── favicon.ico
```

### Backend Build Process

#### Development Mode
```bash
npm run server
# Starts Express server on http://localhost:3001
# Features: Auto-restart on file changes, Detailed logging
```

#### Production Mode
```bash
NODE_ENV=production npm run server
# Optimized for production with clustering support
```

## Environment Configuration

### Environment Variables Strategy

#### Frontend Environment (`.env.local`)
```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

#### Backend Environment (`.env.local`)
```env
# Clerk Backend Integration
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Supabase Admin Access
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Environment-Specific Configurations

#### Development Environment
- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:3001`
- **Database**: Development Supabase project
- **Features**: Hot reload, detailed logging, development tools

#### Staging Environment
- **Frontend**: `https://staging.yourdomain.com`
- **Backend**: `https://staging-api.yourdomain.com`
- **Database**: Staging Supabase project
- **Features**: Production-like configuration, testing data

#### Production Environment
- **Frontend**: `https://app.yourdomain.com`
- **Backend**: `https://api.yourdomain.com`
- **Database**: Production Supabase project
- **Features**: Optimized performance, monitoring, error tracking

## Deployment Strategies

### Frontend Deployment

#### Option 1: Static Hosting (Recommended)
**Suitable for:** Netlify, Vercel, GitHub Pages, AWS S3 + CloudFront

**Deployment Process:**
1. Build the application: `npm run build`
2. Upload `/dist` contents to static hosting provider
3. Configure custom headers for Clerk and Supabase

**Required Headers:**
```
# Clerk Authentication Headers
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin

# Supabase Headers
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

#### Option 2: Node.js Hosting
**Suitable for:** Heroku, DigitalOcean App Platform, AWS EC2

**Deployment Process:**
1. Build the application: `npm run build`
2. Serve static files using Express or nginx
3. Configure reverse proxy for API routes

### Backend Deployment

#### Option 1: Serverless Deployment
**Suitable for:** Vercel Functions, Netlify Functions, AWS Lambda

**Deployment Process:**
1. Restructure Express routes as serverless functions
2. Deploy to serverless platform
3. Configure API Gateway or similar routing

#### Option 2: Container Deployment
**Suitable for:** Docker, Kubernetes, AWS ECS

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "run", "server"]
```

#### Option 3: Traditional Server Deployment
**Suitable for:** DigitalOcean Droplets, AWS EC2, dedicated servers

**Deployment Process:**
1. Set up Node.js runtime environment
2. Configure process manager (PM2 recommended)
3. Set up reverse proxy (nginx recommended)
4. Configure SSL certificates

**PM2 Configuration (`ecosystem.config.js`):**
```javascript
module.exports = {
  apps: [{
    name: 'operational-dashboard-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

### Database Deployment (Supabase)

#### Environment Setup
1. **Development**: Create separate Supabase project for development
2. **Staging**: Create staging project for testing
3. **Production**: Use production project with proper backups

#### Migration Strategy
1. **Schema Migrations**: Use Supabase Dashboard for schema changes
2. **Data Migrations**: Use SQL scripts for data transformations
3. **Version Control**: Track migrations in git repository

## Infrastructure as Code

### Recommended Tools

#### Terraform Configuration Example
```hcl
# Supabase Project
resource "supabase_project" "main" {
  name       = "operational-dashboard"
  region     = "us-east-1"
  plan       = "pro"
}

# Database Configuration
resource "supabase_database" "main" {
  project_id = supabase_project.main.id
  name       = "main"
}

# Edge Functions
resource "supabase_function" "create_user" {
  project_id = supabase_project.main.id
  name       = "create-user"
  runtime    = "nodejs18"
}
```

## Monitoring and Observability

### Application Monitoring

#### Frontend Monitoring
- **Error Tracking**: Sentry, LogRocket, or Bugsnag
- **Performance Monitoring**: Google Analytics, Web Vitals
- **User Analytics**: PostHog, Mixpanel, or Amplitude

#### Backend Monitoring
- **Error Tracking**: Sentry or Rollbar
- **Performance Monitoring**: New Relic or DataDog
- **Health Checks**: Custom health check endpoints

#### Database Monitoring
- **Query Performance**: Supabase Dashboard metrics
- **Connection Pooling**: Supabase connection monitoring
- **Storage Usage**: Database size and growth tracking

### Logging Strategy

#### Structured Logging
```javascript
// Backend logging example
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'operational-dashboard-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

#### Log Aggregation
- **Centralized Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Cloud Logging**: AWS CloudWatch, Google Cloud Logging
- **Log Analysis**: Automated log parsing and alerting

## Security Considerations

### Environment Security

#### Secret Management
```bash
# Use different secrets for each environment
# Never commit secrets to version control
# Use secret management services in production

# Development
echo "VITE_CLERK_PUBLISHABLE_KEY=pk_test_dev_..." > .env.local
echo "CLERK_SECRET_KEY=sk_test_dev_..." >> .env.local

# Production
echo "VITE_CLERK_PUBLISHABLE_KEY=pk_live_prod_..." > .env.production
echo "CLERK_SECRET_KEY=sk_live_prod_..." >> .env.production
```

#### Access Control
- **Environment Variables**: Restrict access to sensitive configuration
- **API Keys**: Rotate keys regularly and use different keys per environment
- **Database Credentials**: Use least-privilege access principles

### Network Security

#### CORS Configuration
```javascript
// Backend CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com', 'https://app.yourdomain.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

#### Security Headers
```javascript
// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
```

## Performance Optimization

### Frontend Performance

#### Build Optimization
```bash
# Analyze bundle size
npm run build -- --analyze

# Preview production build
npm run preview

# Serve optimized build
npm run serve
```

#### Asset Optimization
- **Image Optimization**: WebP format, responsive images
- **Code Splitting**: Automatic code splitting by route
- **Tree Shaking**: Remove unused code
- **Compression**: Gzip/Brotli compression

### Backend Performance

#### Clustering Configuration
```javascript
import cluster from 'cluster';
import os from 'os';

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Worker process - start server
  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} started`);
  });
}
```

#### Caching Strategy
```javascript
// Response caching middleware
const cache = new Map();

app.use('/api/cacheable-endpoint', (req, res, next) => {
  const key = req.originalUrl;

  if (cache.has(key)) {
    return res.json(cache.get(key));
  }

  // Store original json method
  const originalJson = res.json;
  res.json = function(data) {
    cache.set(key, data);
    // Set cache expiry (5 minutes)
    setTimeout(() => cache.delete(key), 5 * 60 * 1000);
    return originalJson.call(this, data);
  };

  next();
});
```

## Backup and Recovery

### Database Backup Strategy

#### Automated Backups
- **Daily Backups**: Automated daily database snapshots
- **Point-in-Time Recovery**: Continuous backup for disaster recovery
- **Cross-Region Replication**: Geographic redundancy

#### Backup Verification
```sql
-- Verify backup integrity
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM master_locations;
SELECT COUNT(*) FROM stock;
```

### Application Backup
- **Code Repository**: Git-based version control with branch protection
- **Configuration Backup**: Automated environment configuration backup
- **Asset Backup**: Static asset backup and CDN synchronization

## Disaster Recovery

### Recovery Time Objectives (RTO)
- **Critical Functions**: < 4 hours
- **Important Functions**: < 24 hours
- **Normal Functions**: < 72 hours

### Recovery Point Objectives (RPO)
- **Database**: < 1 hour (point-in-time recovery)
- **Configuration**: < 24 hours (automated backups)
- **Code**: < 1 hour (git-based recovery)

### Recovery Procedures

#### Database Recovery
1. **Identify Recovery Point**: Determine acceptable data loss
2. **Restore from Backup**: Use Supabase point-in-time recovery
3. **Verify Data Integrity**: Check data consistency
4. **Update DNS**: Redirect traffic to recovered instance

#### Application Recovery
1. **Deploy Latest Code**: Deploy from version control
2. **Restore Configuration**: Apply environment configuration
3. **Verify Functionality**: Test all critical functions
4. **Monitor Performance**: Watch for issues post-recovery

## Cost Optimization

### Infrastructure Cost Management

#### Development Environment
- **Free Tier**: Use Supabase free tier for development
- **Local Development**: Run services locally when possible
- **Resource Sharing**: Share development resources across team

#### Production Environment
- **Right-Sizing**: Choose appropriate instance sizes
- **Auto-Scaling**: Implement auto-scaling for variable loads
- **Reserved Instances**: Use reserved instances for predictable workloads

### Monitoring Costs
- **Log Retention**: Configure appropriate log retention periods
- **Metric Collection**: Collect only necessary metrics
- **Alert Optimization**: Reduce false-positive alerts

## Compliance and Governance

### Data Protection
- **GDPR Compliance**: Data protection and privacy measures
- **Data Retention**: Automated data cleanup procedures
- **Access Logging**: Comprehensive audit trails

### Security Compliance
- **Regular Audits**: Automated security scanning
- **Vulnerability Management**: Prompt patch management
- **Incident Response**: Documented incident response procedures

---

*This deployment architecture guide provides comprehensive information for deploying, monitoring, and maintaining the Internal Operations Monitoring System across different environments. It covers build processes, security considerations, performance optimization, and operational procedures.*