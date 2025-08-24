# Contributing to Design Automation System (DAS)

Thank you for your interest in contributing to DAS! This document provides guidelines and information for contributors to help make the development process smooth and collaborative.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to making participation in this project a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to a positive environment:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior:
- Use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

Before contributing, ensure you have:
- Python 3.11 or higher
- Git
- A GitHub account
- Basic knowledge of Django and Django REST Framework
- Familiarity with PostgreSQL (for database-related contributions)

### Setting Up Development Environment

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/yourusername/DAS.git
   cd DAS/webserver
   ```

2. **Create development environment**
   ```bash
   python3.11 -m venv env
   source env/bin/activate  # On Windows: env\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up development database**
   ```bash
   cp configs/config.toml.sample configs/config.toml
   # Edit config.toml for development settings
   python manage.py migrate
   python manage.py createsuperuser
   ```

4. **Install development tools**
   ```bash
   pip install black flake8 isort pytest-django coverage
   ```

5. **Run tests to verify setup**
   ```bash
   python manage.py test
   ```

## Development Workflow

### Branching Strategy

We use a feature branch workflow:

1. **Main Branch**: `main` - stable, production-ready code
2. **Feature Branches**: `feature/description` - new features
3. **Bug Fix Branches**: `fix/description` - bug fixes  
4. **Documentation Branches**: `docs/description` - documentation updates

### Creating a Feature Branch

```bash
# Start from main branch
git checkout main
git pull origin main

# Create and switch to feature branch
git checkout -b feature/your-feature-name

# Make your changes
git add .
git commit -m "Add feature description"

# Push to your fork
git push origin feature/your-feature-name
```

### Commit Message Format

Use conventional commit format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
git commit -m "feat(modeling): add execution batch tracking"
git commit -m "fix(fronts): resolve login redirect issue"
git commit -m "docs(api): update authentication examples"
```

### Keeping Your Branch Updated

```bash
# Add upstream remote (one time setup)
git remote add upstream https://github.com/original/DAS.git

# Keep your fork updated
git checkout main
git pull upstream main
git push origin main

# Rebase your feature branch
git checkout feature/your-feature-name
git rebase main
```

## Coding Standards

### Python Style Guide

We follow PEP 8 with some project-specific guidelines:

#### Code Formatting

Use **Black** for code formatting:
```bash
black --line-length 88 .
```

#### Import Organization

Use **isort** for import sorting:
```bash
isort .
```

#### Import Order:
1. Standard library imports
2. Third-party imports  
3. Django imports
4. Local application imports

```python
import os
import sys
from typing import List, Optional

import requests
from redis import Redis

from django.db import models
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Project
from .utils import validate_branch
```

#### Code Style Guidelines

```python
# Good: Descriptive variable names
execution_status = get_execution_status(target_id, criterion_id)

# Bad: Unclear abbreviations  
exec_stat = get_exec_stat(tid, cid)

# Good: Clear function documentation
def create_execution(target: Target, criterion: Criterion, branch: str = "main") -> Execution:
    """
    Create a new execution for the given target and criterion.
    
    Args:
        target: The target to execute against
        criterion: The criterion to evaluate
        branch: Git branch name (defaults to "main")
        
    Returns:
        The created execution instance
        
    Raises:
        ValidationError: If target and criterion are incompatible
    """
    pass

# Good: Type hints
def get_recent_executions(limit: int = 10) -> List[Execution]:
    return Execution.objects.order_by('-created_at')[:limit]

# Good: Constants
MAX_EXECUTION_TIMEOUT = 3600  # seconds
DEFAULT_BUILD_NUMBER = "latest"
```

#### Django-Specific Guidelines

```python
# Models: Use descriptive field names and help_text
class Execution(models.Model):
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_REQUESTED,
        help_text="Current execution status"
    )
    
    class Meta:
        db_table = 'modeling_execution'
        indexes = [
            models.Index(fields=['status', 'created_at']),
        ]

# Serializers: Include field validation
class ExecutionSerializer(serializers.ModelSerializer):
    display_value = serializers.SerializerMethodField()
    
    class Meta:
        model = Execution
        fields = '__all__'
        
    def get_display_value(self, obj):
        return obj.get_display_value()
        
    def validate_branch(self, value):
        if not value.strip():
            raise serializers.ValidationError("Branch name cannot be empty")
        return value.strip()

# Views: Use proper HTTP status codes and error handling
class ExecutionViewSet(viewsets.ModelViewSet):
    queryset = Execution.objects.select_related('target', 'criterion')
    serializer_class = ExecutionSerializer
    
    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except ValidationError as e:
            return Response(
                {"detail": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
```

### Frontend Guidelines

#### JavaScript Style

```javascript
// Use const/let instead of var
const API_BASE_URL = '/api';
let executionData = {};

// Use meaningful function names
function updateExecutionStatus(executionId, newStatus) {
    return fetch(`${API_BASE_URL}/executions/${executionId}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ status: newStatus })
    });
}

// Use async/await for promises
async function loadProjects() {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/`);
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Failed to load projects:', error);
        showErrorMessage('Failed to load projects');
    }
}
```

#### CSS/SCSS Guidelines

```css
/* Use BEM naming convention */
.execution-matrix {
    display: grid;
    gap: 1rem;
}

.execution-matrix__cell {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
}

.execution-matrix__cell--success {
    background-color: var(--success-color);
}

/* Use CSS custom properties for theming */
:root {
    --primary-color: #0066cc;
    --success-color: #28a745;
    --warning-color: #ffc107;
    --error-color: #dc3545;
}

/* Mobile-first responsive design */
.project-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
}

@media (min-width: 768px) {
    .project-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 1200px) {
    .project-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}
```

## Testing Guidelines

### Test Structure

We use Django's built-in testing framework with pytest for enhanced functionality.

#### Test Organization

```
tests/
├── unit/
│   ├── test_models.py
│   ├── test_serializers.py
│   └── test_utils.py
├── integration/
│   ├── test_api.py
│   └── test_views.py
└── functional/
    ├── test_workflows.py
    └── test_jenkins_integration.py
```

#### Writing Tests

```python
# models/tests.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from .models import Project, Target, Criterion, Execution

User = get_user_model()

class ExecutionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.project = Project.objects.create(
            name='Test Project',
            description='Test project description'
        )
        self.repository = Repository.objects.create(
            name='test_repo',
            url='git@example.com:test/repo.git'
        )
        self.target = Target.objects.create(
            name='test_target',
            type='IP',
            repository=self.repository
        )
        self.criterion = Criterion.objects.create(
            name='Test Criterion',
            description='Test criterion description'
        )

    def test_execution_creation(self):
        """Test creating a new execution"""
        execution = Execution.objects.create(
            target=self.target,
            criterion=self.criterion,
            branch='main',
            build_number='123'
        )
        
        self.assertEqual(execution.status, 'REQUESTED')
        self.assertEqual(execution.target, self.target)
        self.assertEqual(execution.criterion, self.criterion)
        self.assertEqual(execution.branch, 'main')

    def test_execution_status_transition(self):
        """Test valid status transitions"""
        execution = Execution.objects.create(
            target=self.target,
            criterion=self.criterion
        )
        
        # Valid transition
        execution.status = 'RUNNING'
        execution.save()
        self.assertEqual(execution.status, 'RUNNING')

    def test_get_display_value(self):
        """Test display value calculation"""
        execution = Execution.objects.create(
            target=self.target,
            criterion=self.criterion,
            status='SUCCESS'
        )
        
        self.assertEqual(execution.get_display_value(), 'PASS')
```

#### API Testing

```python
# tests/integration/test_api.py
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class ExecutionAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        # Set up test data...
        
    def test_create_execution_authenticated(self):
        """Test creating execution with authentication"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'target': self.target.id,
            'criterion': self.criterion.id,
            'branch': 'main',
            'build_number': '456'
        }
        
        response = self.client.post('/api/executions/', data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Execution.objects.count(), 1)
        
    def test_create_execution_unauthenticated(self):
        """Test creating execution without authentication"""
        data = {
            'target': self.target.id,
            'criterion': self.criterion.id,
        }
        
        response = self.client.post('/api/executions/', data)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
```

### Running Tests

```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test modeling

# Run with coverage
coverage run manage.py test
coverage report
coverage html  # Generate HTML report

# Run with pytest (more features)
pytest
pytest --cov=. --cov-report=html
```

### Test Coverage Requirements

- **Minimum Coverage**: 80% overall
- **Critical Components**: 95% coverage required
  - Models
  - API serializers
  - Authentication logic
  - Business logic functions

## Documentation

### Code Documentation

#### Docstring Format

Use Google-style docstrings:

```python
def create_execution_batch(targets, criteria, branch="main", build_number=None):
    """Create multiple executions in a batch operation.
    
    This function creates execution records for all combinations of the provided
    targets and criteria, optimizing database operations through bulk creation.
    
    Args:
        targets (List[Target]): List of target objects to execute against.
        criteria (List[Criterion]): List of criteria to evaluate.
        branch (str, optional): Git branch name. Defaults to "main".
        build_number (str, optional): Build identifier. Defaults to None.
        
    Returns:
        List[Execution]: List of created execution objects.
        
    Raises:
        ValidationError: If any target-criterion combination is invalid.
        IntegrityError: If duplicate executions would be created.
        
    Example:
        >>> targets = Target.objects.filter(type='IP')
        >>> criteria = Criterion.objects.filter(available_ip=True)
        >>> executions = create_execution_batch(targets, criteria, branch='develop')
        >>> len(executions)
        6
    """
```

#### API Documentation

Document API endpoints with detailed examples:

```python
class ExecutionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing execution records.
    
    Provides CRUD operations for execution management with filtering
    and pagination support.
    
    ## Filtering
    
    - `status`: Filter by execution status
    - `target`: Filter by target ID
    - `criterion`: Filter by criterion ID  
    - `branch`: Filter by Git branch name
    
    ## Example Usage
    
        # List all successful executions
        GET /api/executions/?status=SUCCESS
        
        # Get executions for specific target
        GET /api/executions/?target=1
        
        # Create new execution
        POST /api/executions/
        {
            "target": 1,
            "criterion": 2,
            "branch": "main",
            "build_number": "123"
        }
    """
```

### README Updates

When adding new features:

1. Update the feature list in README.md
2. Add configuration examples if needed
3. Update installation instructions for new dependencies
4. Add usage examples for significant features

### Changelog

Maintain CHANGELOG.md using Keep a Changelog format:

```markdown
# Changelog

## [Unreleased]

### Added
- New execution batch API endpoint
- Support for DFTed target type
- Real-time status updates via WebSocket

### Changed
- Improved execution matrix performance
- Updated Django to 5.0.6

### Fixed
- Login redirect issue for authenticated users
- Execution status transition validation

## [1.0.0] - 2024-01-15

### Added
- Initial release
- Core project and target management
- Execution tracking system
- Jenkins integration
- REST API with JWT authentication
```

## Pull Request Process

### Before Submitting

1. **Code Quality Checklist**
   - [ ] Code follows project style guidelines
   - [ ] All tests pass
   - [ ] New tests added for new functionality
   - [ ] Documentation updated
   - [ ] No merge conflicts with main branch

2. **Run Quality Checks**
   ```bash
   # Format code
   black .
   isort .
   
   # Check style
   flake8 .
   
   # Run tests
   python manage.py test
   coverage run manage.py test
   coverage report
   ```

### Pull Request Template

Use this template for your PR description:

```markdown
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)  
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

Describe the tests that you ran to verify your changes.

## Screenshots (if applicable)

Add screenshots to help explain your changes.

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Related Issues

Closes #123
Related to #456
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Peer Review**: At least one maintainer review required
3. **Testing**: Reviewer tests changes in development environment
4. **Approval**: Maintainer approves and merges

### Merge Requirements

- All CI checks pass
- At least one approved review
- Up to date with main branch
- No conflicts

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
## Bug Description

A clear and concise description of what the bug is.

## Steps to Reproduce

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior

A clear description of what you expected to happen.

## Actual Behavior  

A clear description of what actually happened.

## Screenshots

If applicable, add screenshots to help explain your problem.

## Environment

- OS: [e.g. Ubuntu 22.04]
- Browser: [e.g. Chrome 91]  
- Python Version: [e.g. 3.11.2]
- Django Version: [e.g. 5.0.6]

## Additional Context

Add any other context about the problem here.
```

### Feature Requests

Use the feature request template:

```markdown
## Feature Description

A clear and concise description of the feature you'd like to see.

## Problem Statement

Describe the problem this feature would solve.

## Proposed Solution

A clear description of what you want to happen.

## Alternatives Considered

Describe any alternative solutions you've considered.

## Additional Context

Add any other context, mockups, or examples about the feature request.

## Implementation Ideas

If you have ideas about how this could be implemented, please share them.
```

### Issue Labels

We use these labels to categorize issues:

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `priority:high`: High priority issue
- `priority:medium`: Medium priority issue
- `priority:low`: Low priority issue

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Email**: For security-related issues

### Getting Help

1. **Check existing documentation** in the `docs/` directory
2. **Search existing issues** on GitHub
3. **Ask in GitHub Discussions** for general questions
4. **Create an issue** for bugs or feature requests

### Recognition

Contributors are recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

### Maintainers

Current maintainers:
- Lead Maintainer: [Name] (@username)
- Backend Maintainer: [Name] (@username)
- Frontend Maintainer: [Name] (@username)

## Development Tips

### Useful Commands

```bash
# Development server with auto-reload
python manage.py runserver

# Create migrations
python manage.py makemigrations

# Apply migrations  
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic

# Django shell
python manage.py shell

# Database shell
python manage.py dbshell
```

### IDE Setup

#### VS Code Settings

```json
{
    "python.defaultInterpreterPath": "./env/bin/python",
    "python.linting.enabled": true,
    "python.linting.flake8Enabled": true,
    "python.formatting.provider": "black",
    "python.formatting.blackArgs": ["--line-length", "88"],
    "python.sortImports.args": ["--profile", "black"],
    "[python]": {
        "editor.formatOnSave": true,
        "editor.codeActionsOnSave": {
            "source.organizeImports": true
        }
    }
}
```

#### Recommended Extensions

- Python
- Django
- GitLens
- Better Comments
- Bracket Pair Colorizer
- Auto Rename Tag

### Debugging

#### Django Debug Toolbar

```python
# Add to settings.py for development
if DEBUG:
    INSTALLED_APPS += ['debug_toolbar']
    MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE
    INTERNAL_IPS = ['127.0.0.1']
```

#### Logging Configuration

```python
# Use logging for debugging
import logging

logger = logging.getLogger(__name__)

def my_function():
    logger.debug("Debug message")
    logger.info("Info message") 
    logger.warning("Warning message")
    logger.error("Error message")
```

Thank you for contributing to DAS! Your contributions help make semiconductor design verification more efficient and reliable for everyone.