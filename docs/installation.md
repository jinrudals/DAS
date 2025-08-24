# Installation Guide

This guide provides detailed instructions for setting up the Design Automation System (DAS) in different environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows with WSL2
- **Python**: 3.11 or higher
- **Database**: PostgreSQL 12+ (recommended) or SQLite3 for development
- **Memory**: Minimum 4GB RAM, 8GB+ recommended for production
- **Storage**: 10GB+ available disk space

### Required Software

1. **Python 3.11+**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install python3.11 python3.11-venv python3.11-dev
   
   # CentOS/RHEL
   sudo yum install python311 python311-devel
   
   # macOS (using Homebrew)
   brew install python@3.11
   ```

2. **Git**
   ```bash
   # Ubuntu/Debian
   sudo apt install git
   
   # CentOS/RHEL
   sudo yum install git
   
   # macOS
   brew install git
   ```

3. **PostgreSQL** (for production)
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib postgresql-server-dev-all
   
   # CentOS/RHEL
   sudo yum install postgresql postgresql-server postgresql-devel
   
   # macOS
   brew install postgresql
   ```

## Development Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd DAS/webserver
```

### 2. Create Virtual Environment

```bash
python3.11 -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate
```

### 3. Install Dependencies

The project includes pre-downloaded wheels in the `downloads/` directory for offline installation:

```bash
# Install from requirements.txt (will use downloads/ directory if available)
pip install -r requirements.txt

# Or install from downloaded wheels directly
pip install downloads/*.whl
```

### 4. Configuration

Copy the sample configuration file:

```bash
cp configs/config.toml.sample configs/config.toml
```

Edit `configs/config.toml` for development:

```toml
[database.development]
engine = "django.db.backends.sqlite3"
name = "db.sqlite3"

[jenkins]
URL = "http://localhost:8080/"  # Your Jenkins URL
TOKEN = "your_jenkins_token"
JOB = "job/path/to/your/job"

[logging]
level = "DEBUG"
file = "myapp.log"
```

### 5. Database Migration

```bash
python manage.py migrate
```

### 6. Create Superuser

```bash
python manage.py createsuperuser
```

### 7. Collect Static Files

```bash
python manage.py collectstatic
```

### 8. Run Development Server

```bash
python manage.py runserver
```

The application will be available at `http://localhost:8000`.

## Production Setup

### 1. System User

Create a dedicated user for the application:

```bash
sudo adduser --system --group --home /opt/das das
sudo mkdir -p /opt/das
sudo chown das:das /opt/das
```

### 2. Application Setup

```bash
sudo su - das
cd /opt/das

# Clone repository
git clone <your-repository-url> .
cd webserver

# Create virtual environment
python3.11 -m venv env
source env/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Production Configuration

```bash
cp configs/config.toml.sample configs/config.toml
```

Edit `configs/config.toml` for production:

```toml
[database.production]
engine = "django.db.backends.postgresql"
name = "das_db"
user = "das_user"
password = "secure_password"
host = "localhost"
port = 5432

[jenkins]
URL = "http://your-jenkins-server:8080/"
TOKEN = "production_token"
JOB = "job/production/job/das/job/runner"

[logging]
level = "INFO"
file = "/var/log/das/das.log"

[security]
allowed_hosts = ["your-domain.com", "192.168.1.100"]
debug = false
secret_key = "your-very-secure-secret-key"
```

### 4. Database Setup (PostgreSQL)

```bash
sudo su - postgres
createuser --interactive das_user
createdb --owner=das_user das_db
psql -c "ALTER USER das_user WITH PASSWORD 'secure_password';"
exit
```

### 5. Application Database Migration

```bash
# As das user
cd /opt/das/webserver
source env/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

### 6. System Service

Install the systemd service:

```bash
sudo cp design_web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable design_web
sudo systemctl start design_web
```

### 7. Web Server (Nginx)

Install and configure Nginx:

```bash
sudo apt install nginx

# Create configuration
sudo nano /etc/nginx/sites-available/das
```

Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Static files
    location /static/ {
        alias /opt/das/webserver/statics/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Main application
    location / {
        proxy_pass http://127.0.0.1:8238;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check
    location /health/ {
        proxy_pass http://127.0.0.1:8238;
        access_log off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/das /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Configuration

### Environment Variables

For production, set these environment variables:

```bash
export DJANGO_SETTINGS_MODULE=server.settings
export DJANGO_SECRET_KEY=your-secret-key
export DJANGO_DEBUG=False
```

### Configuration File Structure

The `configs/config.toml` file supports multiple environments:

```toml
[database.development]
engine = "django.db.backends.sqlite3"
name = "db.sqlite3"

[database.production]
engine = "django.db.backends.postgresql"
name = "das_db"
user = "das_user"
password = "password"
host = "localhost"
port = 5432

[jenkins]
URL = "http://jenkins-server:8080/"
TOKEN = "your_token"
JOB = "job/path/to/automation/job"
USERNAME = "jenkins_user"  # Optional

[logging]
level = "INFO"
file = "logs/das.log"
max_size = "100MB"
backup_count = 5

[security]
allowed_hosts = ["localhost", "127.0.0.1"]
debug = false
secret_key = "change-this-in-production"
```

## Database Setup

### SQLite (Development)

SQLite is used by default for development. No additional setup required.

### PostgreSQL (Production)

1. **Install PostgreSQL**:
   ```bash
   sudo apt install postgresql postgresql-contrib
   ```

2. **Create Database and User**:
   ```bash
   sudo su - postgres
   psql
   
   CREATE USER das_user WITH PASSWORD 'secure_password';
   CREATE DATABASE das_db OWNER das_user;
   GRANT ALL PRIVILEGES ON DATABASE das_db TO das_user;
   \q
   exit
   ```

3. **Configure PostgreSQL** (optional tuning):
   ```bash
   sudo nano /etc/postgresql/14/main/postgresql.conf
   ```
   
   Add/modify:
   ```
   shared_buffers = 256MB
   effective_cache_size = 1GB
   maintenance_work_mem = 64MB
   ```

4. **Test Connection**:
   ```bash
   psql -h localhost -U das_user -d das_db
   ```

### Database Migrations

Always run migrations when updating:

```bash
python manage.py migrate
```

For production deployments with zero-downtime:

```bash
python manage.py migrate --run-syncdb
```

## Troubleshooting

### Common Issues

#### 1. Permission Denied Errors

```bash
# Fix ownership
sudo chown -R das:das /opt/das
sudo chmod +x /opt/das/webserver/manage.py
```

#### 2. Database Connection Issues

```bash
# Test PostgreSQL connection
sudo su - das
psql -h localhost -U das_user -d das_db

# Check PostgreSQL service
sudo systemctl status postgresql
```

#### 3. Static Files Not Loading

```bash
# Recollect static files
python manage.py collectstatic --noinput

# Check permissions
sudo chown -R das:das /opt/das/webserver/statics/
```

#### 4. Jenkins Integration Issues

```bash
# Test Jenkins connectivity
curl -u username:token http://your-jenkins:8080/api/json

# Check Jenkins configuration in config.toml
```

#### 5. Service Not Starting

```bash
# Check service status
sudo systemctl status design_web

# Check logs
journalctl -u design_web -f

# Check application logs
tail -f /var/log/das/das.log
```

### Performance Optimization

#### 1. Database Optimization

```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_execution_status ON modeling_execution(status);
CREATE INDEX CONCURRENTLY idx_execution_target_criterion ON modeling_execution(target_id, criterion_id);
```

#### 2. Application Optimization

```bash
# Install Redis for caching
sudo apt install redis-server

# Update settings for Redis caching
# Add to config.toml:
[cache]
backend = "django_redis.cache.RedisCache"
location = "redis://127.0.0.1:6379/1"
```

#### 3. Web Server Optimization

```nginx
# Add to nginx configuration
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/css application/javascript application/json;

# Enable HTTP/2
listen 443 ssl http2;
```

### Log Analysis

#### Application Logs

```bash
# View recent logs
tail -f /var/log/das/das.log

# Search for errors
grep -i error /var/log/das/das.log

# View specific time period
grep "2024-01-15" /var/log/das/das.log
```

#### Service Logs

```bash
# View service logs
journalctl -u design_web -f

# View logs from specific time
journalctl -u design_web --since "2024-01-15 10:00:00"
```

### Health Checks

Create a simple health check script:

```bash
#!/bin/bash
# health_check.sh

curl -f http://localhost:8238/admin/ > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "DAS is healthy"
    exit 0
else
    echo "DAS is unhealthy"
    exit 1
fi
```

## Next Steps

After successful installation:

1. **Review the [API Documentation](api.md)** for integration details
2. **Check the [Deployment Guide](deployment.md)** for production best practices  
3. **Read the [Contributing Guide](contributing.md)** if you plan to develop features
4. **Set up monitoring and alerting** for production environments
5. **Configure backups** for your database and application data

## Support

If you encounter issues during installation:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review the application logs for specific error messages
3. Consult the GitHub Issues page for known problems
4. Join the community discussions for help from other users