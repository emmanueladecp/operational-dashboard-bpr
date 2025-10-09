# API Reference Documentation

## Overview

This document provides comprehensive documentation for all API endpoints in the Internal Operations Monitoring System, including REST endpoints, webhook handlers, and Supabase Edge Functions.

## Backend API Endpoints (Express Server)

### Base URL
```
Development: http://localhost:3001
Production: https://api.yourdomain.com
```

### Authentication

All API endpoints (except health checks and webhooks) require proper authentication through Clerk JWT tokens included in the Authorization header.

```
Authorization: Bearer <clerk_jwt_token>
```

### Health Check

#### GET /api/health

**Description:** Basic health check endpoint to verify server status.

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

**Example:**
```bash
curl http://localhost:3001/api/health
```

---

## User Management API

### Create User

#### POST /api/users/create

**Description:** Creates a new user in both Clerk and Supabase systems.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required, min 8 characters)",
  "role": "string (required)",
  "locations": "array of strings (optional)"
}
```

**Valid Roles:**
- `SUPERADMIN_ROLE`
- `BOD_ROLE`
- `SALES_MANAGER_ROLE`
- `SALES_SUPERVISOR_ROLE`
- `AUDITOR_ROLE`

**Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": "string",
    "clerk_id": "string",
    "name": "string",
    "username": "string",
    "role": "string",
    "locations": ["string"]
  }
}
```

**Error Responses:**

**400 Bad Request (Validation Error):**
```json
{
  "error": "Missing required fields: username, password, and role are required"
}
```

**400 Bad Request (Password Too Short):**
```json
{
  "error": "Password must be at least 8 characters long"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create user in database",
  "details": "Database connection error"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/users/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <clerk_token>" \
  -d '{
    "username": "john_doe",
    "password": "SecurePassword123",
    "role": "SALES_MANAGER_ROLE",
    "locations": ["Jakarta", "Surabaya"]
  }'
```

### Update User

#### PATCH /api/users/:userId

**Description:** Updates user role and/or location assignments.

**Path Parameters:**
- `userId`: Supabase user ID (UUID format)

**Request Body:**
```json
{
  "role": "string (optional)",
  "locations": "array of strings (optional)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully"
}
```

**Error Responses:**

**404 Not Found:**
```json
{
  "error": "User not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to update user in database",
  "details": "Database connection error"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3001/api/users/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <clerk_token>" \
  -d '{
    "role": "SALES_SUPERVISOR_ROLE",
    "locations": ["Bandung", "Medan"]
  }'
```

### Delete User

#### DELETE /api/users/:userId

**Description:** Deletes user from both Clerk and Supabase systems.

**Path Parameters:**
- `userId`: Supabase user ID (UUID format)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Responses:**

**404 Not Found:**
```json
{
  "error": "User not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to delete user from database",
  "details": "Database connection error"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3001/api/users/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <clerk_token>"
```

---

## Webhook API

### Clerk Webhook Handler

#### POST /api/webhooks/clerk

**Description:** Receives and processes webhook events from Clerk for user synchronization.

**Headers Required:**
```
svix-id: <webhook_id>
svix-timestamp: <timestamp>
svix-signature: <signature>
Content-Type: application/json
```

**Webhook Events Supported:**
- `user.created`
- `user.updated`
- `user.deleted`

**Request Body (varies by event):**
```json
{
  "type": "user.created",
  "data": {
    "id": "string",
    "username": "string",
    "public_metadata": {
      "role": "string",
      "locations": ["string"]
    },
    "first_name": "string",
    "last_name": "string"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**

**400 Bad Request (Missing Headers):**
```json
{
  "error": "Missing svix headers"
}
```

**400 Bad Request (Invalid Signature):**
```json
{
  "error": "Invalid signature"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "details": "Database connection error"
}
```

---

## Supabase Edge Functions

### Base URL
```
https://your-project.supabase.co/functions/v1/
```

### Create User Function

#### POST /create-user

**Description:** Supabase Edge Function for user management operations (create, update, delete).

**Request Body:**
```json
{
  "action": "string (required)",
  "username": "string (required for create)",
  "password": "string (required for create)",
  "role": "string (required for create/update)",
  "locations": "array of strings (optional)",
  "clerkId": "string (required for update/delete)"
}
```

**Actions:**

#### Create User Action
```json
{
  "action": "create-user",
  "username": "john_doe",
  "password": "SecurePassword123",
  "role": "SALES_MANAGER_ROLE",
  "locations": ["Jakarta"]
}
```

#### Update User Action
```json
{
  "action": "update-user",
  "clerkId": "user_123",
  "role": "SALES_SUPERVISOR_ROLE",
  "locations": ["Bandung", "Medan"]
}
```

#### Delete User Action
```json
{
  "action": "delete-user",
  "clerkId": "user_123"
}
```

**Response (varies by action):**

**Create User (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": "string",
    "clerk_id": "string",
    "name": "string",
    "role": "string",
    "locations": ["string"]
  }
}
```

**Update/Delete User (200 OK):**
```json
{
  "success": true,
  "message": "User updated/deleted successfully"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Username, password, and role are required"
}
```

**400 Bad Request (Invalid Role):**
```json
{
  "error": "Invalid role specified"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create user in database: [details]"
}
```

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase_anon_key>" \
  -d '{
    "action": "create-user",
    "username": "jane_doe",
    "password": "AnotherSecurePassword123",
    "role": "AUDITOR_ROLE"
  }'
```

---

## Database Schema API

### Tables Overview

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'NO_ROLE',
  locations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Master Locations Table
```sql
CREATE TABLE master_locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Stock Table
```sql
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  product_type TEXT NOT NULL,
  product_category_name TEXT NOT NULL,
  sumqtyonhand DECIMAL NOT NULL,
  uom_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS) Policies

#### Users Table Policies
```sql
-- Users can read their own record
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.jwt() ->> 'sub' = clerk_id);

-- Super admins can read all users
CREATE POLICY "Super admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = auth.jwt() ->> 'sub'
      AND role = 'SUPERADMIN_ROLE'
    )
  );
```

#### Stock Table Policies
```sql
-- Sales roles can only see data for their assigned locations
CREATE POLICY "Sales roles location access" ON stock
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = auth.jwt() ->> 'sub'
      AND role IN ('SALES_MANAGER_ROLE', 'SALES_SUPERVISOR_ROLE')
      AND location = ANY(locations)
    )
  );

-- Other roles have appropriate access levels
CREATE POLICY "Other roles stock access" ON stock
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = auth.jwt() ->> 'sub'
      AND role IN ('SUPERADMIN_ROLE', 'BOD_ROLE', 'AUDITOR_ROLE')
    )
  );
```

---

## Error Codes and Handling

### HTTP Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| 200 | OK | Successful requests |
| 201 | Created | Resource successfully created |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server-side error |

### Common Error Messages

#### Authentication Errors
- `"Missing Clerk Publishable Key"` - Frontend Clerk configuration error
- `"Invalid signature"` - Webhook signature verification failed
- `"User not found"` - User doesn't exist in database

#### Validation Errors
- `"Password must be at least 8 characters long"`
- `"Invalid role specified"`
- `"Missing required fields"`

#### Database Errors
- `"Failed to create user in database"`
- `"Database connection error"`
- `"Row Level Security policy violation"`

### Error Response Format

All error responses follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "details": "Technical details (optional)",
  "code": "ERROR_CODE (optional)"
}
```

---

## Rate Limiting

### API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/users/create` | 10 requests | 1 minute |
| `/api/users/:id` | 30 requests | 1 minute |
| `/api/webhooks/clerk` | 100 requests | 1 minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640995200
```

**Rate Limited Response (429):**
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

---

## SDK and Client Libraries

### JavaScript/TypeScript Client

#### Supabase Client Configuration
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);
```

#### Authenticated Client with Clerk
```typescript
import { createClerkSupabaseClient } from '../lib/supabase';

// Create client with Clerk token injection
const supabaseClient = createClerkSupabaseClient(() =>
  session.getToken()
);
```

### REST API Client Example

```javascript
class OperationsAPI {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async createUser(userData, token) {
    const response = await fetch(`${this.baseURL}/api/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async updateUser(userId, updates, token) {
    const response = await fetch(`${this.baseURL}/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    return response.json();
  }
}
```

---

## Testing API Endpoints

### Manual Testing with cURL

#### Health Check
```bash
curl http://localhost:3001/api/health
```

#### Create User
```bash
curl -X POST http://localhost:3001/api/users/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "username": "test_user",
    "password": "TestPassword123",
    "role": "SALES_MANAGER_ROLE"
  }'
```

#### Update User
```bash
curl -X PATCH http://localhost:3001/api/users/<user-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "role": "SALES_SUPERVISOR_ROLE"
  }'
```

### Automated Testing

#### Jest Testing Example
```javascript
describe('User API', () => {
  test('creates user successfully', async () => {
    const response = await request(app)
      .post('/api/users/create')
      .send({
        username: 'test_user',
        password: 'TestPassword123',
        role: 'SALES_MANAGER_ROLE'
      })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
```

---

## API Versioning

### Version Strategy

Current API version: **v1**

**Version Header:**
```
API-Version: v1
```

**URL Versioning (Future):**
```
/api/v1/users/create
/api/v2/users/create
```

### Breaking Changes Policy

- **Major Version Bump**: Breaking changes in API contract
- **Minor Version Bump**: New features without breaking existing functionality
- **Patch Version Bump**: Bug fixes and performance improvements

---

## Support and Troubleshooting

### Common Issues

#### Authentication Issues
1. **Invalid Token**: Ensure Clerk token is valid and not expired
2. **Missing Authorization Header**: Include `Authorization: Bearer <token>`
3. **CORS Issues**: Check CORS configuration for frontend requests

#### Database Issues
1. **RLS Policy Violations**: Ensure user has appropriate permissions
2. **Connection Errors**: Check Supabase service status
3. **Data Type Mismatches**: Verify request data types match schema

#### Webhook Issues
1. **Signature Verification**: Ensure webhook secret is correctly configured
2. **Missing Headers**: Verify all required Svix headers are present
3. **Event Processing**: Check server logs for webhook processing errors

### Debugging Tips

#### Enable Debug Logging
```bash
DEBUG=* npm run server
```

#### Check Webhook Delivery
- Use Svix Play for webhook debugging
- Monitor server logs for webhook events
- Verify webhook signatures in development

#### Database Query Debugging
```sql
-- Enable query logging in Supabase dashboard
-- Check RLS policies in Supabase SQL editor
-- Monitor query performance in Supabase metrics
```

---

*This API reference provides comprehensive documentation for all endpoints, error handling, authentication, and integration patterns. It serves as the authoritative source for developers integrating with the Internal Operations Monitoring System.*