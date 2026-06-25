# API Documentation

## Overview
This document provides comprehensive API documentation for this workspace. It includes endpoint definitions, request/response formats, usage examples, and testing guidelines designed for AI Models to understand, design, modify, and implement the API.

## API Meta Data

### Base URLs
| Environment | URL | Description |
|-------------|-----|-------------|
| **Development** | `http://localhost:3000/api` | Local development server |
| **Staging** | `https://staging-api.example.com/api` | Pre-production testing environment |
| **Production** | `https://api.example.com/api` | Live production environment |

### API Version
- **Current Version**: v1.0.0
- **Versioning Strategy**: URL-based versioning (`/api/v1/endpoint`)
- **Supported Versions**: v1.0.x (latest)

### Authentication
All protected endpoints require JWT authentication:
```http
Authorization: Bearer <jwt_token>
```

### Rate Limiting
| Level | Limit | Description |
|-------|-------|-------------|
| **Standard** | 100 requests/15 minutes | Per IP address |
| **Authenticated** | 1000 requests/15 minutes | Per authenticated user |

### Common Headers
| Header | Required | Description | Example |
|--------|----------|-------------|---------|
| `Content-Type` | Yes | Request content type | `application/json` |
| `Accept` | Yes | Expected response type | `application/json` |
| `Authorization` | Conditional | JWT bearer token | `Bearer eyJhbGciOiJIUzI1NiIs...` |
| `X-Request-ID` | Optional | Unique request identifier | `req_123456` |

### Common Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123"
}
```

## API Definitions

**Guidelines**: This section is organized by controller classes. Each controller groups related API endpoints. Follow the source code links to view detailed implementation.

---

### AuthController

**Source Code**: `server/src/main/java/com/example/api/controller/AuthController.java`

**Description**: Handles authentication-related operations including login, registration, and token management.

| Endpoint | Method | Description | Security | Status Codes |
|----------|--------|-------------|----------|--------------|
| `/auth/login` | POST | Authenticate user and obtain JWT token | Public | 200, 400, 401, 429, 500 |
| `/auth/register` | POST | Register new user account | Public | 201, 400, 409, 429, 500 |
| `/auth/refresh` | POST | Refresh JWT token | JWT Required | 200, 401, 500 |
| `/auth/logout` | POST | Invalidate current token | JWT Required | 200, 401, 500 |

#### POST /auth/login

**Description**: Authenticates a user with email and password credentials, returning a JWT token for subsequent API calls.

**Request Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `email` | string | Yes | User's email address | `"user@example.com"` |
| `password` | string | Yes | User's password | `"password123"` |

**Success Response (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["USER"]
  },
  "expiresIn": 3600
}
```

**Error Responses**:
- **400** - Invalid request format
- **401** - Invalid credentials
- **429** - Rate limit exceeded

#### POST /auth/register

**Description**: Creates a new user account with email, password, and profile information.

**Request Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `email` | string | Yes | User's email address (must be unique) | `"newuser@example.com"` |
| `password` | string | Yes | Password (min 8 chars, 1 uppercase, 1 number) | `"Password123!"` |
| `name` | string | Yes | User's full name | `"New User"` |
| `confirmPassword` | string | Yes | Password confirmation (must match password) | `"Password123!"` |

**Success Response (201)**:
```json
{
  "user": {
    "id": 2,
    "email": "newuser@example.com",
    "name": "New User",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "verificationRequired": true
}
```

**Error Responses**:
- **400** - Validation error (invalid email format, weak password)
- **409** - Email already exists
- **429** - Rate limit exceeded

---

### UserController

**Source Code**: `server/src/main/java/com/example/api/controller/UserController.java`

**Description**: Manages user profile operations including viewing and updating user information.

| Endpoint | Method | Description | Security | Status Codes |
|----------|--------|-------------|----------|--------------|
| `/users/me` | GET | Get current authenticated user's profile | JWT Required | 200, 401, 404, 500 |
| `/users/me` | PUT | Update current user's profile | JWT Required | 200, 400, 401, 404, 500 |
| `/users/{id}` | GET | Get public user profile by ID | Public | 200, 404, 500 |

#### GET /users/me

**Description**: Retrieves the profile information of the currently authenticated user.

**Request Parameters**: None (uses JWT token for identification)

**Success Response (200)**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "profile": {
    "avatarUrl": "https://example.com/avatar.jpg",
    "phoneNumber": "+1234567890",
    "address": "123 Main St, City, Country"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
- **401** - Invalid or expired token
- **404** - User not found
- **500** - Internal server error

#### PUT /users/me

**Description**: Updates the profile information of the currently authenticated user. Only provided fields will be updated.

**Request Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `name` | string | No | User's full name | `"Updated Name"` |
| `profile` | object | No | Profile information object | See below |
| `profile.phoneNumber` | string | No | Phone number in E.164 format | `"+0987654321"` |
| `profile.address` | string | No | Full address | `"456 Oak St, City, Country"` |
| `profile.avatarUrl` | string | No | Profile image URL | `"https://example.com/avatar.jpg"` |

**Success Response (200)**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Updated Name",
  "profile": {
    "avatarUrl": "https://example.com/avatar.jpg",
    "phoneNumber": "+0987654321",
    "address": "456 Oak St, City, Country"
  },
  "updatedAt": "2024-01-20T12:00:00Z"
}
```

**Error Responses**:
- **400** - Invalid data format
- **401** - Invalid or expired token
- **404** - User not found

---

## API Testing

### cURL Test Commands

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test.user@example.com","password":"TestPassword123!"}'

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new.user@example.com","password":"SecurePassword123!","name":"New Test User","confirmPassword":"SecurePassword123!"}'

# Get user profile (requires token)
TOKEN="your-jwt-token-here"
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Update user profile
curl -X PUT http://localhost:3000/api/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Updated Name","profile":{"phoneNumber":"+0987654321","address":"456 Oak St, City, Country"}}'
```

## Error Codes Reference

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## API Changelog

| Version | Date | Changes |
|---------|------|---------|
| **v1.0.0** | 2024-01-01 | Initial API release |

---

*This API documentation template is organized by controller classes. Follow the source code links to view detailed implementation. Update this document using `/context-update-instruction` whenever endpoints change.*
