# API Documentation

The Design Automation System (DAS) provides a comprehensive REST API built with Django REST Framework. This document covers all available endpoints, authentication, and usage examples.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Response Formats](#response-formats)
- [Core Endpoints](#core-endpoints)
- [Authentication Endpoints](#authentication-endpoints)
- [Integration Endpoints](#integration-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Base URL

All API endpoints are prefixed with `/api/`:

```
Production: https://your-domain.com/api/
Development: http://localhost:8000/api/
```

## Authentication

The API uses JWT (JSON Web Token) authentication with refresh tokens.

### Token Authentication

All API requests (except authentication endpoints) require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### Token Lifecycle

- **Access Token**: Valid for 15 minutes
- **Refresh Token**: Valid for 1 day
- **Automatic Refresh**: Use refresh token to get new access token

## Response Formats

### Success Response

```json
{
    "count": 25,
    "next": "http://localhost:8000/api/projects/?page=2",
    "previous": null,
    "results": [
        // ... data objects
    ]
}
```

### Error Response

```json
{
    "detail": "Authentication credentials were not provided.",
    "code": "not_authenticated"
}
```

### Validation Error Response

```json
{
    "field_name": [
        "This field is required."
    ]
}
```

## Core Endpoints

### Projects

#### List Projects
```http
GET /api/projects/
```

**Response:**
```json
{
    "count": 3,
    "results": [
        {
            "id": 1,
            "name": "Project Alpha",
            "description": "Main SoC design project",
            "maturity_level": "ML2",
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-20T14:45:00Z",
            "repositories": [1, 2, 3]
        }
    ]
}
```

#### Create Project
```http
POST /api/projects/
Content-Type: application/json

{
    "name": "New Project",
    "description": "Project description",
    "maturity_level": "ML1"
}
```

#### Get Project Details
```http
GET /api/projects/{id}/
```

### Repositories

#### List Repositories
```http
GET /api/repositories/
```

**Response:**
```json
{
    "results": [
        {
            "id": 1,
            "name": "main_repo",
            "url": "git@github.com:company/main_repo.git",
            "default_branch": "main",
            "created_at": "2024-01-15T10:30:00Z"
        }
    ]
}
```

#### Create Repository
```http
POST /api/repositories/
Content-Type: application/json

{
    "name": "new_repo",
    "url": "git@github.com:company/new_repo.git",
    "default_branch": "main"
}
```

### Targets

#### List Targets
```http
GET /api/targets/
```

**Query Parameters:**
- `type`: Filter by target type (`IP`, `HPDF`, `DFTed`)
- `repository`: Filter by repository ID

**Response:**
```json
{
    "results": [
        {
            "id": 1,
            "name": "cpu_core",
            "type": "IP",
            "repository": 1,
            "is_ip": true,
            "is_hpdf": false,
            "relative_path": "blocks/cpu_core",
            "created_at": "2024-01-15T10:30:00Z"
        }
    ]
}
```

#### Create Target
```http
POST /api/targets/
Content-Type: application/json

{
    "name": "new_target",
    "type": "IP",
    "repository": 1,
    "relative_path": "blocks/new_target"
}
```

### Criteria

#### List Criteria
```http
GET /api/criteria/
```

**Response:**
```json
{
    "results": [
        {
            "id": 1,
            "name": "RTL Lint",
            "description": "RTL linting checks",
            "group": 1,
            "group_name": "Verification",
            "order": 1,
            "available_ip": true,
            "available_hpdf": false,
            "available_dfted": true,
            "display_type": "PASS_FAIL",
            "unit": null
        }
    ]
}
```

#### Create Criterion
```http
POST /api/criteria/
Content-Type: application/json

{
    "name": "New Check",
    "description": "Custom verification check",
    "group": 1,
    "available_ip": true,
    "available_hpdf": false
}
```

### Criterion-Target Relationships

#### List Criterion-Target Pairs
```http
GET /api/criterion_targets/
```

**Query Parameters:**
- `target`: Filter by target ID
- `criterion`: Filter by criterion ID
- `has_owner`: Filter by ownership status

**Response:**
```json
{
    "results": [
        {
            "id": 1,
            "target": 1,
            "target_name": "cpu_core",
            "criterion": 1,
            "criterion_name": "RTL Lint",
            "owner": "john.doe@company.com",
            "recent_execution": {
                "id": 123,
                "status": "SUCCESS",
                "build_number": "456",
                "branch": "main",
                "created_at": "2024-01-20T15:30:00Z"
            }
        }
    ]
}
```

#### Update Criterion-Target Owner
```http
PATCH /api/criterion_targets/{id}/
Content-Type: application/json

{
    "owner": "new.owner@company.com"
}
```

### Executions

#### List Executions
```http
GET /api/executions/
```

**Query Parameters:**
- `status`: Filter by status (`REQUESTED`, `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `ERROR`, `SKIPPED`, `TIMEOUT`)
- `target`: Filter by target ID
- `criterion`: Filter by criterion ID
- `branch`: Filter by branch name
- `build_number`: Filter by build number
- `workflow_type`: Filter by workflow type

**Response:**
```json
{
    "results": [
        {
            "id": 123,
            "target": 1,
            "target_name": "cpu_core",
            "criterion": 1,
            "criterion_name": "RTL Lint",
            "status": "SUCCESS",
            "branch": "main",
            "build_number": "456",
            "workflow_type": "IP",
            "log_file": "/logs/execution_123.log",
            "created_at": "2024-01-20T15:30:00Z",
            "updated_at": "2024-01-20T15:45:00Z",
            "duration": 900,
            "evaluated_ml1": true,
            "evaluated_ml2": true,
            "evaluated_ml3": false,
            "display_value": "PASS"
        }
    ]
}
```

#### Create Execution
```http
POST /api/executions/
Content-Type: application/json

{
    "target": 1,
    "criterion": 1,
    "branch": "main",
    "build_number": "789",
    "workflow_type": "IP"
}
```

#### Update Execution Status
```http
PATCH /api/executions/{id}/
Content-Type: application/json

{
    "status": "RUNNING",
    "log_file": "/logs/execution_123.log"
}
```

#### Get Execution Details
```http
GET /api/execution-detail/{id}/
```

**Response:**
```json
{
    "id": 123,
    "target_name": "cpu_core",
    "criterion_name": "RTL Lint",
    "status": "SUCCESS",
    "branch": "main",
    "build_number": "456",
    "owner": "john.doe@company.com",
    "log_content": "Execution log content...",
    "created_at": "2024-01-20T15:30:00Z",
    "updated_at": "2024-01-20T15:45:00Z"
}
```

## Authentication Endpoints

### Login
```http
POST /api/auth/login/
Content-Type: application/json

{
    "email": "user@company.com",
    "password": "your_password"
}
```

**Response:**
```json
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "user": {
        "id": 1,
        "email": "user@company.com",
        "first_name": "John",
        "last_name": "Doe"
    }
}
```

### Refresh Token
```http
POST /api/auth/refresh/
Content-Type: application/json

{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Response:**
```json
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### Logout
```http
POST /api/auth/logout/
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### User Registration
```http
POST /api/auth/users/
Content-Type: application/json

{
    "email": "newuser@company.com",
    "password": "secure_password",
    "first_name": "Jane",
    "last_name": "Smith"
}
```

### User Profile
```http
GET /api/auth/users/me/
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
    "id": 1,
    "email": "user@company.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_staff": false,
    "is_superuser": false,
    "date_joined": "2024-01-15T10:30:00Z"
}
```

## Integration Endpoints

### Jenkins Integration

#### Trigger Jenkins Job
```http
POST /api/jenkins-submit/
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
    "targets": [1, 2, 3],
    "criteria": [1, 2],
    "branch": "main",
    "workflow_type": "IP"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Jenkins job triggered successfully",
    "job_url": "http://jenkins:8080/job/das/123/"
}
```

### Bulk Operations

#### Bulk Update Owners
```http
PATCH /api/update/{target_id}/{criterion_id}/
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
    "owner": "new.owner@company.com"
}
```

#### Bulk Clean Executions
```http
POST /api/bulk/clean/{build_number}/
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
    "success": true,
    "cleaned_count": 25,
    "message": "Cleaned 25 executions for build 456"
}
```

## Error Handling

### HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully  
- `204 No Content`: Resource deleted successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Permission denied
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Common Error Codes

#### Authentication Errors
```json
{
    "detail": "Authentication credentials were not provided.",
    "code": "not_authenticated"
}
```

#### Permission Errors
```json
{
    "detail": "You do not have permission to perform this action.",
    "code": "permission_denied"
}
```

#### Validation Errors
```json
{
    "name": ["This field is required."],
    "email": ["Enter a valid email address."]
}
```

#### Not Found Errors
```json
{
    "detail": "Not found.",
    "code": "not_found"
}
```

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Authenticated users**: 1000 requests per hour
- **Anonymous users**: 100 requests per hour
- **Authentication endpoints**: 5 requests per minute

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

## Examples

### Python Client Example

```python
import requests
import json

class DASClient:
    def __init__(self, base_url, email, password):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.access_token = None
        self.refresh_token = None
        self.login(email, password)
    
    def login(self, email, password):
        """Authenticate and get tokens"""
        response = self.session.post(
            f"{self.base_url}/api/auth/login/",
            json={"email": email, "password": password}
        )
        response.raise_for_status()
        
        data = response.json()
        self.access_token = data['access']
        self.refresh_token = data['refresh']
        
        # Set default authorization header
        self.session.headers.update({
            'Authorization': f'Bearer {self.access_token}'
        })
    
    def refresh_access_token(self):
        """Refresh the access token"""
        response = self.session.post(
            f"{self.base_url}/api/auth/refresh/",
            json={"refresh": self.refresh_token}
        )
        response.raise_for_status()
        
        data = response.json()
        self.access_token = data['access']
        self.session.headers.update({
            'Authorization': f'Bearer {self.access_token}'
        })
    
    def get_projects(self):
        """Get all projects"""
        response = self.session.get(f"{self.base_url}/api/projects/")
        response.raise_for_status()
        return response.json()
    
    def create_execution(self, target_id, criterion_id, branch="main", build_number=None):
        """Create a new execution"""
        data = {
            "target": target_id,
            "criterion": criterion_id,
            "branch": branch
        }
        if build_number:
            data["build_number"] = build_number
            
        response = self.session.post(
            f"{self.base_url}/api/executions/",
            json=data
        )
        response.raise_for_status()
        return response.json()
    
    def trigger_jenkins_job(self, targets, criteria, branch="main"):
        """Trigger Jenkins job for multiple target-criterion pairs"""
        data = {
            "targets": targets,
            "criteria": criteria,
            "branch": branch
        }
        
        response = self.session.post(
            f"{self.base_url}/api/jenkins-submit/",
            json=data
        )
        response.raise_for_status()
        return response.json()

# Usage example
client = DASClient("http://localhost:8000", "user@company.com", "password")

# Get all projects
projects = client.get_projects()
print(f"Found {projects['count']} projects")

# Create execution
execution = client.create_execution(target_id=1, criterion_id=2, branch="develop")
print(f"Created execution {execution['id']}")

# Trigger Jenkins job
result = client.trigger_jenkins_job(targets=[1, 2], criteria=[1, 2, 3])
print(f"Jenkins job triggered: {result['job_url']}")
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

class DASClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.client = axios.create({
            baseURL: this.baseUrl
        });
        this.accessToken = null;
        this.refreshToken = null;
    }

    async login(email, password) {
        try {
            const response = await this.client.post('/api/auth/login/', {
                email,
                password
            });

            this.accessToken = response.data.access;
            this.refreshToken = response.data.refresh;

            // Set default authorization header
            this.client.defaults.headers.common['Authorization'] = 
                `Bearer ${this.accessToken}`;

            return response.data.user;
        } catch (error) {
            throw new Error(`Login failed: ${error.response.data.detail}`);
        }
    }

    async getProjects() {
        try {
            const response = await this.client.get('/api/projects/');
            return response.data;
        } catch (error) {
            if (error.response.status === 401) {
                await this.refreshAccessToken();
                return this.getProjects();
            }
            throw error;
        }
    }

    async createExecution(targetId, criterionId, branch = 'main', buildNumber = null) {
        const data = {
            target: targetId,
            criterion: criterionId,
            branch
        };

        if (buildNumber) {
            data.build_number = buildNumber;
        }

        try {
            const response = await this.client.post('/api/executions/', data);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to create execution: ${error.response.data}`);
        }
    }

    async refreshAccessToken() {
        try {
            const response = await this.client.post('/api/auth/refresh/', {
                refresh: this.refreshToken
            });

            this.accessToken = response.data.access;
            this.client.defaults.headers.common['Authorization'] = 
                `Bearer ${this.accessToken}`;
        } catch (error) {
            throw new Error('Token refresh failed, please login again');
        }
    }
}

// Usage example
(async () => {
    const client = new DASClient('http://localhost:8000');
    
    try {
        // Login
        const user = await client.login('user@company.com', 'password');
        console.log(`Logged in as ${user.email}`);

        // Get projects
        const projects = await client.getProjects();
        console.log(`Found ${projects.count} projects`);

        // Create execution
        const execution = await client.createExecution(1, 2, 'develop');
        console.log(`Created execution ${execution.id}`);

    } catch (error) {
        console.error('Error:', error.message);
    }
})();
```

### cURL Examples

#### Authentication
```bash
# Login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "user@company.com", "password": "password"}'

# Use token in subsequent requests
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."

# Get projects
curl -X GET http://localhost:8000/api/projects/ \
  -H "Authorization: Bearer $TOKEN"

# Create execution
curl -X POST http://localhost:8000/api/executions/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target": 1, "criterion": 2, "branch": "main"}'

# Trigger Jenkins job
curl -X POST http://localhost:8000/api/jenkins-submit/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targets": [1, 2], "criteria": [1, 2, 3], "branch": "main"}'
```

## API Versioning

Currently, the API is version 1.0. Future versions will be handled through:

1. **URL Versioning**: `/api/v2/projects/`
2. **Header Versioning**: `Accept: application/vnd.das.v2+json`
3. **Backward Compatibility**: V1 endpoints will remain available

## OpenAPI/Swagger Documentation

Interactive API documentation is available at:

- **Swagger UI**: `http://localhost:8000/api/swagger/`
- **ReDoc**: `http://localhost:8000/api/redoc/`
- **OpenAPI Schema**: `http://localhost:8000/api/schema/`

## Support

For API-related questions or issues:

1. Check this documentation first
2. Review the interactive API docs at `/api/swagger/`
3. Check GitHub Issues for known problems
4. Join the community discussions for help