# Design Automation System (DAS)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![Django](https://img.shields.io/badge/Django-5.0+-green.svg)](https://djangoproject.com)

A comprehensive EDA automation platform designed for semiconductor design verification workflows. DAS orchestrates multi-component testing across System-on-Chip (SoC) projects, managing High-level Physical Design Flows (HPDFs) and Intellectual Property blocks (IPs) through automated verification, synthesis, and analysis processes.

## 🎯 Mission

Eliminate manual testing errors and provide unified automation for all design verification tasks across SoC projects, supporting RTL verification, lint checking, clock domain analysis, synthesis flows, and power verification.

## ✨ Features

### Core Capabilities
- **🔄 Automated Regression Testing** - Continuous verification of design changes
- **📊 Project Management** - Centralized tracking of design projects and targets
- **🔧 Jenkins Integration** - Seamless CI/CD pipeline integration for automated workflows
- **📈 Real-time Monitoring** - Live status tracking and execution monitoring
- **🔍 Advanced Filtering** - Powerful search and filter capabilities for large datasets
- **🎯 Multi-Target Support** - Handle IP blocks, HPDF flows, and DFT verification
- **📝 Audit Trails** - Complete history tracking with django-simple-history
- **🔐 JWT Authentication** - Secure API access with token-based auth
- **🎨 Modern UI** - Bootstrap 5 responsive interface

### Technical Features
- **RESTful API** - Complete REST API with Django REST Framework
- **Web Interface** - Full-featured web UI with interactive execution matrix
- **Pattern-Based Evaluation** - Configurable success/failure criteria
- **Multi-Repository Support** - Git integration with build tracking
- **Scalable Architecture** - Modular Django apps for different concerns

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Django    │───▶│   Jenkins    │───▶│    wit      │───▶│  workscript  │
│   Backend   │    │   Pipeline   │    │ Workspace   │    │ DAG Engine   │
│ (API + Web) │    │ Orchestrator │    │  Manager    │    │   Runner     │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ PostgreSQL  │    │ Git Repos +  │    │ Multi-Repo  │    │ SLURM/Kafka  │
│  Database   │    │ Python Scripts│    │ Workspace   │    │  Execution   │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

### Components
- **Django Backend** - This repository: data management, REST APIs, and web UI
- **Jenkins Pipeline** - Workflow execution orchestration
- **CLI Tools** - wit, workscript for development and automation
- **External Integration** - Git, SLURM, Kafka for distributed execution

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL (or SQLite for development)
- Git
- Node.js (optional, for frontend development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DAS/webserver
   ```

2. **Create virtual environment**
   ```bash
   python3 -m venv env
   source env/bin/activate  # On Windows: env\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure the application**
   ```bash
   cp configs/config.toml.sample configs/config.toml
   # Edit config.toml with your database and Jenkins settings
   ```

5. **Set up the database**
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. **Collect static files**
   ```bash
   python manage.py collectstatic
   ```

7. **Run the development server**
   ```bash
   python manage.py runserver
   ```

Visit `http://localhost:8000` to access the application.

## 📖 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Installation Guide](docs/installation.md)** - Detailed setup instructions
- **[API Documentation](docs/api.md)** - REST API reference
- **[Deployment Guide](docs/deployment.md)** - Production deployment
- **[Contributing](docs/contributing.md)** - Development guidelines
- **[Architecture](docs/architecture.md)** - System architecture details

## 🛠️ Technology Stack

### Backend
- **Framework**: Django 5.0.6 with ASGI support
- **API**: Django REST Framework 3.15.2
- **Database**: PostgreSQL/SQLite3 (configurable)
- **Authentication**: JWT with djangorestframework-simplejwt
- **History Tracking**: django-simple-history

### Frontend
- **UI Framework**: Bootstrap 5
- **JavaScript**: jQuery for interactions
- **Templates**: Django templates with custom tags
- **Icons**: Bootstrap Icons

### Infrastructure
- **Server**: Gunicorn + Uvicorn for production
- **CI/CD**: Jenkins integration
- **Version Control**: Git with multi-repository support
- **Process Management**: Systemd service

## 🏃‍♂️ Usage

### Web Interface

1. **Dashboard** - View all projects in a card-based layout
2. **Project Detail** - Interactive execution matrix showing Target vs Criterion results
3. **Filtering** - Filter by type (IP/HPDF/DFTed), branch, and date
4. **Jenkins Integration** - Trigger jobs directly from the web interface
5. **Real-time Updates** - Monitor execution status in real-time

### API Usage

```python
import requests

# Authentication
response = requests.post('/api/auth/login/', {
    'email': 'user@example.com',
    'password': 'password'
})
token = response.json()['access']

# List projects
headers = {'Authorization': f'Bearer {token}'}
projects = requests.get('/api/projects/', headers=headers)

# Create execution
execution_data = {
    'target': 1,
    'criterion': 2,
    'branch': 'main',
    'build_number': '123'
}
execution = requests.post('/api/executions/', json=execution_data, headers=headers)
```

## 🏗️ Development

### Project Structure

```
├── accounts/           # User management
├── modeling/          # Core domain logic (Projects, Targets, Criteria)
├── fronts/           # Web interface & integration
├── server/           # Django configuration
├── configs/          # Configuration files
├── statics/          # Collected static files
└── docs/             # Documentation
```

### Key Django Apps

- **accounts/** - User authentication, teams, JWT handling
- **modeling/** - Core business models and API endpoints
- **fronts/** - Web views, templates, static assets, Jenkins integration

### Running Tests

```bash
python manage.py test
```

### Development Server

```bash
# With debug toolbar and hot reload
python manage.py runserver

# Production mode
gunicorn -c gunicorn.conf.py server.asgi:application
```

## 🔧 Configuration

Configuration uses TOML files for different environments:

```toml
[database.production]
host = "localhost"
name = "das_db"
user = "das_user"
password = "your_password"

[database.development]
engine = "django.db.backends.sqlite3"
name = "db.sqlite3"

[jenkins]
URL = "http://your-jenkins:8080/"
TOKEN = "your_token"
JOB = "job/path/to/your/automation/job"
```

## 🚀 Deployment

### Production Deployment

1. **System Service** (using provided systemd service file)
   ```bash
   sudo cp design_web.service /etc/systemd/system/
   sudo systemctl enable design_web
   sudo systemctl start design_web
   ```

2. **Web Server** (nginx example)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:8238;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /static/ {
           alias /path/to/DAS/webserver/statics/;
       }
   }
   ```

3. **Environment Variables**
   ```bash
   export DJANGO_SETTINGS_MODULE=server.settings
   export DJANGO_SECRET_KEY=your-secret-key
   ```

### Docker Deployment (Optional)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "-c", "gunicorn.conf.py", "server.asgi:application"]
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/contributing.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Run the test suite (`python manage.py test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use type hints where appropriate
- Write comprehensive docstrings
- Add tests for new functionality
- Update documentation for significant changes

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` directory for detailed guides
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join our community discussions for questions and ideas

## 🎯 Roadmap

### Current Version (1.0.0)
- ✅ Core project and target management
- ✅ Execution tracking and status monitoring
- ✅ Jenkins integration
- ✅ Web interface with filtering
- ✅ REST API with JWT authentication

### Upcoming Features
- 🔄 Real-time WebSocket updates
- 📊 Advanced analytics and reporting
- 🔌 Plugin system for custom evaluations
- 🐳 Docker containerization
- ☁️ Cloud deployment templates
- 📱 Mobile-responsive improvements

## 🙏 Acknowledgments

- Built with [Django](https://djangoproject.com/) and [Django REST Framework](https://django-rest-framework.org/)
- UI powered by [Bootstrap 5](https://getbootstrap.com/)
- Icons from [Bootstrap Icons](https://icons.getbootstrap.com/)

---

**Design Automation System** - Streamlining semiconductor design verification workflows.