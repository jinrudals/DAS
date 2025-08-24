# CLAUDE.md

This file provides comprehensive guidance to Claude Code when working with the DAS (Design Automation System) backend codebase.

## Project Overview

DAS Backend is a full-stack Django application that manages design automation workflows for hardware verification projects. It provides both REST APIs and a complete web interface for managing design verification workflows, execution tracking, and team collaboration.

### System Architecture

The DAS backend is part of a distributed system:
- **Django Backend**: This codebase - data management, REST APIs, and web UI
- **Jenkins Pipeline**: Workflow execution orchestration (`git@192.128.1.103:infra/design/pipeline.git`)
- **CLI Tools**: wit, workscript, workscript-configs for development and automation

## Technology Stack

### Core Framework
- **Django 5.0.6**: Main web framework with ASGI support
- **Django REST Framework 3.15.2**: API layer
- **PostgreSQL/SQLite3**: Database (configurable via config.toml)
- **Gunicorn + Uvicorn**: ASGI production server

### Frontend Technologies
- **Bootstrap 5**: UI framework with django-bootstrap5 integration
- **jQuery**: JavaScript interactions and AJAX calls
- **Template Engine**: Django templates with custom tags and filters
- **Static Files**: CSS/JS organized by page and components

### Key Dependencies
- **JWT Authentication**: djangorestframework-simplejwt 5.5.0, djoser 2.3.1
- **Model History**: django-simple-history 3.8.0 for audit trails
- **File Management**: Built-in Django file handling for execution logs
- **Filtering**: django-filter 21.1 for API filtering capabilities

## Application Structure

### Django Apps

#### `accounts/` - User Management
- **Models**: Custom User (email-based auth), Team
- **Authentication**: JWT-based with email login, smart serializers for different HTTP methods
- **Templates**: Login, logout, profile management, user registration pages
- **Features**: Team-based user organization, custom user creation

#### `modeling/` - Core Domain Logic
- **Models**: Project, Repository, Target, Criterion, CriterionTarget, Execution, EvaluationRule, EvaluationPattern
- **API**: Complete REST API endpoints via DRF ViewSets
- **Features**: Design verification workflow management, execution tracking, scoring system

#### `fronts/` - Web Interface & Integration
- **Views**: Django class-based views for web pages, API views for AJAX endpoints
- **Templates**: Bootstrap-based responsive web UI
- **Static Assets**: Organized CSS/JS for enhanced user experience
- **Jenkins Integration**: Utilities for triggering Jenkins builds and handling callbacks
- **Features**: Project dashboard, execution matrix view, real-time status updates

#### `server/` - Django Configuration
- **Settings**: Environment-aware configuration with TOML support
- **URLs**: URL routing for all applications
- **ASGI/WSGI**: Production server configuration

### Frontend Architecture

#### Template Structure
```
fronts/templates/
├── layouts/base.html           # Base template with Bootstrap integration
├── components/
│   ├── navbar.html            # Navigation component
│   └── project-card.html      # Project display cards
└── pages/
    ├── index.html             # Dashboard with project grid
    └── project/detail.html    # Execution matrix view with filters
```

#### Static Assets Organization
```
fronts/static/
├── css/
│   ├── common.css             # Global styles
│   ├── components/            # Component-specific styles
│   └── page/                  # Page-specific styles
└── js/
    └── page/project/detail.js # Interactive execution matrix
```

#### Key Frontend Features
- **Responsive Design**: Mobile-first Bootstrap 5 layout
- **Interactive Matrix**: Target vs Criterion execution status grid
- **Real-time Updates**: AJAX-powered status refreshing
- **Jenkins Integration**: Direct job triggering from web interface
- **Filtering**: Date, branch, and workflow type filtering
- **Modal Details**: Execution details with log viewing
- **Local Storage**: User preferences persistence

### Configuration System

Configuration uses TOML files with environment-specific overrides:

```toml
[database.production]
host = "localhost"
# PostgreSQL configuration

[database.development]
engine = "django.db.backends.sqlite3"
name = "db.sqlite3"

[jenkins]
URL = "http://192.128.1.90:9999/"
TOKEN = "designteam"
JOB = "job/bos_soc_design/job/n1b0/job/n1b0_ws/job/automation/job/runner"

[logging]
# Structured logging configuration
```

## Data Model Architecture

### Core Entities

#### Project-Repository-Target Hierarchy
```
Project (ML1/ML2/ML3 maturity levels) ←→ Repository (Git repos) → Target (IP/HPDF/DFTed types)
```

#### Evaluation System
```
Criterion (evaluation criteria) ←→ Target = CriterionTarget (M2M with owners) → Execution (results)
```

#### Criteria Organization
```
CriteriaGroup (display grouping) → Criterion (ordered within groups)
```

#### Key Relationships
- **Projects ↔ Repositories**: Many-to-many relationship
- **CriterionTarget**: Junction table with ownership and recent execution tracking
- **Execution**: Tracks workflow runs with status, logs, and evaluated maturity levels
- **EvaluationRule + EvaluationPattern**: Configurable scoring system for execution results

### Model Features
- **Historical Records**: All models tracked with django-simple-history
- **Database Indexes**: Custom indexing via `modeling/indexes.py`
- **Validation**: Custom model validation (e.g., Target type requirements)
- **Auto-evaluation**: Execution results automatically evaluated against criteria

## API Architecture

### REST Endpoints (`/api/`)
- `GET|POST /api/projects/` - Project management
- `GET|POST /api/repositories/` - Repository management
- `GET|POST /api/targets/` - Target management
- `GET|POST /api/criteria/` - Criterion management
- `GET|POST|PATCH /api/criterion_targets/` - CriterionTarget relationships
- `GET|POST /api/executions/` - Execution tracking

### Special Endpoints
- `PATCH /api/update/<target>/<criteria>/` - Owner updates
- `POST /api/bulk/clean/<build_number>/` - Bulk execution cleanup
- `POST /api/jenkins-submit/` - Jenkins integration endpoint
- `GET /api/execution-detail/<pk>/` - Execution details API

### Web Interface Endpoints
- `GET /` - Dashboard with project cards
- `GET /project/<name>/` - Detailed project view with execution matrix
- `GET /accounts/login/` - User authentication
- `GET /accounts/profile/` - User profile management

### Authentication
- **JWT Bearer Token**: Required for API access
- **Session Authentication**: Used for web interface
- **Djoser Integration**: User registration, password management
- **Token Refresh**: Automatic token rotation with blacklisting

## Frontend User Experience

### Dashboard (Index Page)
- **Project Grid**: Card-based layout showing all available projects
- **Authentication**: Login/logout functionality with user status
- **Responsive Design**: Works on desktop and mobile devices
- **Welcome Message**: Branded for semiconductor design teams

### Project Detail View
- **Execution Matrix**: Interactive grid showing Target vs Criterion results
- **Advanced Filtering**:
  - Type selection (IP/HPDF/DFTed)
  - Branch filtering with intelligent sorting for HPDF/DFTed
  - Date filtering to view historical results
- **Jenkins Integration**: Direct job triggering with batch selection
- **Status Indicators**: Color-coded execution status with percentage display
- **Modal Details**: Click to view execution logs, owners, and metadata

### Interactive Features
- **Cell Selection**: Multi-select execution cells for batch operations
- **Local Storage**: Remembers user filter preferences
- **Real-time Data**: AJAX loading of execution details
- **Responsive Tables**: Horizontal scrolling for large matrices
- **Sorting**: Clickable column headers for data organization

## Development Workflows

### Environment Setup
```bash
# Virtual environment
python3 -m venv env
source env/bin/activate

# Dependencies (see downloads/ directory for offline packages)
pip install django-bootstrap5 djangorestframework

# Configuration
cp configs/config.toml.sample configs/config.toml
# Edit config.toml with your database and Jenkins settings

# Database setup
python manage.py migrate
python manage.py createsuperuser

# Collect static files for production
python manage.py collectstatic
```

### Development Server
```bash
# Development mode (with debug toolbar)
python manage.py runserver

# Production mode
gunicorn -c gunicorn.conf.py server.asgi:application
```

### Frontend Development
```bash
# Static files during development
# Files in fronts/static/ are automatically served

# CSS/JS changes require browser refresh
# No build process needed - standard Django static files

# Template changes are reflected immediately in DEBUG mode
```

### Testing
```bash
# Run tests
python manage.py test

# Test structure:
# - accounts/tests.py: User and team functionality
# - modeling/tests.py: Core model relationships and business logic
# - fronts/tests.py: Frontend integration tests
```

## Jenkins Integration

### Workflow Orchestration
- **Trigger**: `fronts/utils/jenkins.py` handles job triggering
- **Configuration**: Jenkins URL, token, and job path in config.toml
- **Authentication**: HTTP Basic Auth with username/password or token-based
- **Build Parameters**: Branch selection and execution context

### Web Interface Integration
- **Batch Selection**: Select multiple criterion-target pairs for execution
- **Real-time Feedback**: Status updates and progress indication
- **Branch Management**: Intelligent branch selection for different workflow types
- **Error Handling**: User-friendly error messages for failed job submissions

### Execution Tracking
1. **Job Submission**: Web UI or API triggers Jenkins job
2. **Status Updates**: Jenkins callbacks update execution status
3. **Log Collection**: Execution logs stored and processed
4. **Result Evaluation**: Automatic scoring based on evaluation rules

## File Organization Patterns

### Static Files
- `statics/`: Collected static files for production
- `fronts/static/`: Source static files (CSS, JS, images)
- `statics/admin/`: Django admin static files
- `statics/rest_framework/`: DRF browsable API assets

### Templates
- `accounts/templates/`: Authentication UI (login, logout, profile)
- `fronts/templates/`: Main application UI (index, project details)
- `fronts/templates/components/`: Reusable UI components
- `fronts/templates/layouts/`: Base templates with common structure

### Configuration & Deployment
- `configs/config.toml`: Environment-specific settings
- `gunicorn.conf.py`: Production ASGI server configuration
- `design_web.service`: Systemd service definition
- `Jenkins.yml`: Jenkins pipeline configuration

### Logs & Data
- `myapp.log`: Application logs (configurable via logging config)
- `log/files/`: Execution log file storage
- `downloads/`: Offline dependency packages for deployment

## Security Considerations

### Authentication & Authorization
- **JWT Tokens**: Short-lived access tokens (15 min) with refresh tokens (1 day)
- **Session Authentication**: Secure session cookies for web interface
- **Token Blacklisting**: Prevents token reuse after logout/refresh
- **Email-based Auth**: Users identified by email, not username
- **Team-based Organization**: Users grouped by teams for access control

### Data Protection
- **CSRF Protection**: Built-in Django CSRF middleware for forms
- **SQL Injection**: Django ORM provides automatic protection
- **XSS Prevention**: Template auto-escaping enabled
- **File Upload Security**: Controlled log file storage with validation

### Production Security
- **Secret Key**: Change default secret key in production
- **Debug Mode**: Disable DEBUG in production environments
- **Allowed Hosts**: Configure allowed hosts properly
- **HTTPS**: Use HTTPS for production deployments (configure in web server)

## User Interface Patterns

### Navigation
- **Responsive Navbar**: Bootstrap navbar with user authentication status
- **Breadcrumbs**: Clear navigation hierarchy
- **User Menu**: Profile management and logout functionality

### Data Display
- **Card Layout**: Project cards with hover effects
- **Table Matrix**: Execution status grid with color coding
- **Modal Dialogs**: Detailed information display
- **Form Controls**: Bootstrap form components with validation

### Status Indicators
- **Color Coding**:
  - Green: SUCCESS
  - Red: FAILED
  - Yellow: PENDING/RUNNING
  - Gray: REQUESTED/WAITING
- **Progress Indicators**: Percentage completion display
- **Badges**: Status labels and metadata display

### Interactive Elements
- **Multi-select**: Checkbox-based selection for batch operations
- **Filtering**: Real-time form-based filtering
- **AJAX Loading**: Smooth data loading without page refresh
- **Local Storage**: Persistent user preferences

## Common Development Tasks

### Adding New Models
1. Create model in appropriate app (usually `modeling/`)
2. Add to `modeling/admin.py` for admin interface
3. Create and run migrations: `python manage.py makemigrations && python manage.py migrate`
4. Add serializers in `serializers.py`
5. Create ViewSets and add to `urls.py`
6. Add tests in `tests.py`

### Extending APIs
1. Modify serializers for new fields/relationships
2. Update ViewSets for custom behavior (filtering, permissions)
3. Add custom endpoints in `urls.py` if needed
4. Update frontend templates/JavaScript if UI changes required

### Frontend Modifications
1. **Templates**: Modify HTML structure in `fronts/templates/`
2. **Styles**: Add CSS in `fronts/static/css/` (organized by page/component)
3. **JavaScript**: Update `fronts/static/js/` for interactive features
4. **Components**: Create reusable template includes
5. **Static Files**: Run `python manage.py collectstatic` for production

### Configuration Changes
1. Update `config.toml.sample` with new configuration options
2. Modify `server/settings.py` to read new config values
3. Update documentation and deployment scripts

### Jenkins Integration Updates
1. Modify `fronts/utils/jenkins.py` for API changes
2. Update job configuration and parameters
3. Test integration with development Jenkins instance
4. Update `Jenkins.yml` pipeline configuration if needed

## Performance Considerations

### Database Optimization
- **Indexes**: Custom database indexes defined in `modeling/indexes.py`
- **Query Optimization**: Views use select_related/prefetch_related for relationships
- **Efficient Filtering**: Optimized queryset construction in ProjectDetailView
- **Connection Pooling**: Configure database connection pooling for production

### Frontend Performance
- **Static File Optimization**: Minify CSS/JS for production
- **Template Caching**: Use Django template caching for repeated content
- **AJAX Optimization**: Efficient API calls for dynamic content
- **Local Storage**: Cache user preferences to reduce server requests

### Caching Strategies
- **Static Files**: Collect static files with versioning for browser caching
- **Database Queries**: Consider Django caching framework for repeated queries
- **API Response**: Use DRF throttling and pagination for large datasets

### Monitoring & Logging
- **Structured Logging**: Configurable logging to file and console
- **Error Tracking**: Configure error reporting for production
- **Performance Metrics**: Monitor API response times and database query performance

## Integration Points

### External Systems
- **Jenkins**: Job triggering and status updates via REST API
- **Git Repositories**: Source code management integration
- **CLI Tools**: API consumed by wit, workscript tools
- **File System**: Log file storage and serving

### API Consumers
- **Web Frontend**: Built-in Django templates with AJAX
- **CLI Tools**: External tools consuming REST APIs
- **Jenkins**: Callback webhooks for status updates
- **Mobile/External Apps**: Public API for external integrations

### User Interaction Flows
1. **Login Flow**: Email/password → JWT token → Session establishment
2. **Project Selection**: Dashboard → Project card → Detail view
3. **Execution Workflow**: Filter → Select → Trigger Jenkins → Monitor results
4. **Data Exploration**: Matrix view → Modal details → Log analysis

This documentation provides complete context for understanding and working with the DAS backend codebase. The system combines a robust Django REST API with a modern web interface, providing both programmatic access and user-friendly visualization for design verification workflows.