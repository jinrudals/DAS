# Deployment Guide

This guide covers production deployment strategies, configuration management, monitoring, and maintenance procedures for the Design Automation System (DAS).

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Production Environment](#production-environment)
- [Security Configuration](#security-configuration)
- [Database Configuration](#database-configuration)
- [Web Server Configuration](#web-server-configuration)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Deployment Overview

### Recommended Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Load      │    │   Reverse   │    │   DAS       │
│  Balancer   │────│   Proxy     │────│ Application │
│  (Optional) │    │   (Nginx)   │    │  (Gunicorn) │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Database  │    │   Redis     │    │   Jenkins   │
│ (PostgreSQL)│    │   Cache     │    │   Server    │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Deployment Methods

1. **Traditional Server Deployment** - Recommended for most use cases
2. **Docker Deployment** - For containerized environments
3. **Cloud Deployment** - AWS, GCP, Azure options

## Production Environment

### System Requirements

#### Minimum Requirements
- **CPU**: 4 cores (2.4 GHz+)
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **Network**: 1 Gbps

#### Recommended Requirements
- **CPU**: 8 cores (3.0 GHz+)
- **RAM**: 16GB
- **Storage**: 500GB NVMe SSD
- **Network**: 10 Gbps

### Operating System Setup

#### Ubuntu 22.04 LTS (Recommended)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    postgresql \
    postgresql-contrib \
    nginx \
    redis-server \
    git \
    curl \
    wget \
    htop \
    fail2ban \
    ufw

# Create application user
sudo adduser --system --group --home /opt/das das
```

#### CentOS/RHEL 8/9

```bash
# Enable EPEL repository
sudo dnf install -y epel-release

# Install packages
sudo dnf install -y \
    python311 \
    python311-devel \
    postgresql \
    postgresql-server \
    nginx \
    redis \
    git \
    curl \
    wget \
    htop \
    fail2ban \
    firewalld

# Initialize PostgreSQL
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
```

### Application Deployment

#### 1. Application Setup

```bash
# Switch to application user
sudo su - das
cd /opt/das

# Clone repository
git clone <repository-url> .
cd webserver

# Create virtual environment
python3.11 -m venv env
source env/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

#### 2. Configuration

```bash
# Copy configuration template
cp configs/config.toml.sample configs/config.toml

# Edit configuration
nano configs/config.toml
```

**Production configuration:**

```toml
[database.production]
engine = "django.db.backends.postgresql"
name = "das_production"
user = "das_user"
password = "secure_random_password"
host = "localhost"
port = 5432
conn_max_age = 300
conn_health_checks = true

[cache]
backend = "django_redis.cache.RedisCache"
location = "redis://127.0.0.1:6379/1"
timeout = 300
key_prefix = "das"

[jenkins]
URL = "https://jenkins.company.com/"
TOKEN = "production_jenkins_token"
JOB = "job/production/job/das/job/automation"
USERNAME = "das_jenkins_user"
timeout = 600

[logging]
level = "INFO"
file = "/var/log/das/das.log"
max_size = "100MB"
backup_count = 10
format = "json"

[security]
allowed_hosts = ["das.company.com", "10.0.1.100"]
debug = false
secret_key = "your-very-secure-secret-key-here"
use_tls = true
secure_cookies = true
hsts_seconds = 31536000

[performance]
database_pool_size = 20
max_requests = 1000
max_requests_jitter = 100
worker_connections = 1000

[monitoring]
enable_metrics = true
health_check_url = "/health/"
prometheus_metrics = true
```

#### 3. Database Setup

```bash
# Create database and user
sudo su - postgres
createuser --interactive das_user
createdb --owner=das_user das_production
psql -c "ALTER USER das_user WITH PASSWORD 'secure_random_password';"
psql -d das_production -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
exit

# Run migrations
cd /opt/das/webserver
source env/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
```

#### 4. System Service

Create systemd service file:

```bash
sudo nano /etc/systemd/system/das.service
```

```ini
[Unit]
Description=Design Automation System
After=network.target postgresql.service redis.service
Requires=postgresql.service

[Service]
Type=notify
User=das
Group=das
WorkingDirectory=/opt/das/webserver
Environment=DJANGO_SETTINGS_MODULE=server.settings
Environment=DJANGO_SECRET_KEY=your-secret-key
ExecStart=/opt/das/webserver/env/bin/gunicorn \
    --config /opt/das/webserver/gunicorn.conf.py \
    --bind unix:/opt/das/das.sock \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    server.asgi:application
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/das /var/log/das
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictRealtime=yes

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable das
sudo systemctl start das
sudo systemctl status das
```

## Security Configuration

### Firewall Setup

#### UFW (Ubuntu)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (adjust port as needed)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL (internal only)
sudo ufw allow from 127.0.0.1 to any port 5432

# Check status
sudo ufw status verbose
```

#### Firewalld (CentOS/RHEL)

```bash
# Enable firewall
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Allow services
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=ssh

# Reload configuration
sudo firewall-cmd --reload
```

### Fail2ban Configuration

```bash
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
# Ban hosts for 1 hour
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
```

### SSL Certificate Management

#### Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d das.company.com

# Test renewal
sudo certbot renew --dry-run

# Setup automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Application Security

#### Environment Variables

```bash
# Create environment file
sudo nano /etc/systemd/system/das.service.d/environment.conf
```

```ini
[Service]
Environment="DJANGO_SECRET_KEY=your-very-secure-secret-key"
Environment="DATABASE_PASSWORD=secure_database_password"
Environment="JENKINS_TOKEN=secure_jenkins_token"
```

#### Security Headers

Add to Nginx configuration:

```nginx
# Security headers
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options DENY;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;";
```

## Database Configuration

### PostgreSQL Optimization

#### postgresql.conf

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

```ini
# Memory settings
shared_buffers = 4GB                    # 25% of RAM
effective_cache_size = 12GB             # 75% of RAM
work_mem = 256MB                        # Per connection
maintenance_work_mem = 1GB

# Connection settings
max_connections = 100
superuser_reserved_connections = 3

# Performance settings
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 500

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_min_duration_statement = 1000       # Log slow queries
log_checkpoints = on
log_lock_waits = on
```

#### pg_hba.conf Security

```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

```
# Secure authentication
local   all             postgres                                peer
local   all             all                                     peer
host    das_production  das_user        127.0.0.1/32           md5
host    all             all             127.0.0.1/32           reject
```

### Database Backup Strategy

#### Automated Backups

```bash
#!/bin/bash
# /opt/das/scripts/backup_database.sh

BACKUP_DIR="/opt/das/backups"
DB_NAME="das_production"
DB_USER="das_user"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/das_backup_${DATE}.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h localhost -U $DB_USER -d $DB_NAME | gzip > $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "das_backup_*.sql.gz" -mtime +30 -delete

# Log backup completion
echo "$(date): Backup completed: $BACKUP_FILE" >> /var/log/das/backup.log
```

Setup cron job:

```bash
sudo crontab -e
# Add: 0 2 * * * /opt/das/scripts/backup_database.sh
```

## Web Server Configuration

### Nginx Configuration

#### Main Configuration

```bash
sudo nano /etc/nginx/sites-available/das
```

```nginx
upstream das_app {
    server unix:/opt/das/das.sock fail_timeout=0;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

server {
    listen 80;
    server_name das.company.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name das.company.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/das.company.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/das.company.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/das.company.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/js
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Client settings
    client_max_body_size 50M;
    keepalive_timeout 5;

    # Static files
    location /static/ {
        alias /opt/das/webserver/statics/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        
        # Compression for static files
        location ~* \.(js|css)$ {
            gzip_static on;
        }
    }

    # Media files (if any)
    location /media/ {
        alias /opt/das/webserver/media/;
        expires 7d;
    }

    # Health check
    location /health/ {
        access_log off;
        proxy_pass http://das_app;
        proxy_set_header Host $host;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        include /etc/nginx/proxy_params;
        proxy_pass http://das_app;
    }

    # Login rate limiting
    location /api/auth/login/ {
        limit_req zone=login burst=5 nodelay;
        include /etc/nginx/proxy_params;
        proxy_pass http://das_app;
    }

    # Main application
    location / {
        include /etc/nginx/proxy_params;
        proxy_pass http://das_app;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Security: Block access to sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~ \.(yml|yaml|toml|ini|conf)$ {
        deny all;
    }
}
```

#### Proxy Parameters

```bash
sudo nano /etc/nginx/proxy_params
```

```nginx
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_redirect off;
proxy_buffering off;
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/das /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Load Balancer Configuration (Optional)

For high-availability deployments, use a load balancer:

#### HAProxy Configuration

```haproxy
global
    daemon
    maxconn 4096

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog

frontend das_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/das.pem
    redirect scheme https if !{ ssl_fc }
    
    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request reject if { sc_http_req_rate(0) gt 20 }
    
    default_backend das_backend

backend das_backend
    balance roundrobin
    option httpchk GET /health/
    
    server das1 10.0.1.10:443 check ssl verify none
    server das2 10.0.1.11:443 check ssl verify none backup
```

## Monitoring and Logging

### Application Monitoring

#### Prometheus Metrics

Install prometheus client:

```bash
pip install prometheus-client django-prometheus
```

Add to Django settings:

```python
INSTALLED_APPS = [
    'django_prometheus',
    # ... other apps
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    # ... other middleware
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

DATABASES = {
    'default': {
        # ... database config
        'ENGINE': 'django_prometheus.db.backends.postgresql',
    }
}
```

#### Health Check Endpoint

Create health check view:

```python
# server/health.py
from django.http import JsonResponse
from django.db import connection
import redis

def health_check(request):
    status = {"status": "healthy", "services": {}}
    
    # Check database
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        status["services"]["database"] = "healthy"
    except Exception as e:
        status["services"]["database"] = f"unhealthy: {str(e)}"
        status["status"] = "unhealthy"
    
    # Check Redis
    try:
        r = redis.Redis(host='localhost', port=6379, db=1)
        r.ping()
        status["services"]["redis"] = "healthy"
    except Exception as e:
        status["services"]["redis"] = f"unhealthy: {str(e)}"
        status["status"] = "unhealthy"
    
    return JsonResponse(status)
```

### Log Management

#### Structured Logging Configuration

```python
# server/settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            'class': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        },
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/das/das.log',
            'maxBytes': 100 * 1024 * 1024,  # 100MB
            'backupCount': 10,
            'formatter': 'json',
        },
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'das': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
}
```

#### Log Rotation

```bash
sudo nano /etc/logrotate.d/das
```

```
/var/log/das/*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
    create 644 das das
    postrotate
        systemctl reload das
    endscript
}
```

### Monitoring Stack

#### ELK Stack (Optional)

```bash
# Install Elasticsearch
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt update && sudo apt install elasticsearch

# Configure Logstash for DAS logs
sudo nano /etc/logstash/conf.d/das.conf
```

```ruby
input {
  file {
    path => "/var/log/das/*.log"
    codec => "json"
    type => "das"
  }
}

filter {
  if [type] == "das" {
    mutate {
      add_field => { "environment" => "production" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "das-logs-%{+YYYY.MM.dd}"
  }
}
```

## Performance Optimization

### Database Optimization

#### Connection Pooling

```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'das_production',
        'USER': 'das_user',
        'PASSWORD': 'password',
        'HOST': 'localhost',
        'PORT': '5432',
        'CONN_MAX_AGE': 300,
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {
            'MAX_CONNS': 20,
            'MIN_CONNS': 5,
        }
    }
}
```

#### Query Optimization

```sql
-- Add database indexes
CREATE INDEX CONCURRENTLY idx_execution_status_created 
    ON modeling_execution(status, created_at);
    
CREATE INDEX CONCURRENTLY idx_execution_target_criterion_branch 
    ON modeling_execution(target_id, criterion_id, branch);

-- Analyze table statistics
ANALYZE modeling_execution;
ANALYZE modeling_target;
ANALYZE modeling_criterion;
```

### Caching Strategy

#### Redis Configuration

```bash
sudo nano /etc/redis/redis.conf
```

```ini
# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
bind 127.0.0.1
requirepass your_redis_password
```

#### Django Cache Settings

```python
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'PASSWORD': 'your_redis_password',
        },
        'KEY_PREFIX': 'das',
        'TIMEOUT': 300,
    }
}

# Session cache
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
```

### Application Performance

#### Gunicorn Optimization

```python
# gunicorn.conf.py
import multiprocessing

# Server socket
bind = "unix:/opt/das/das.sock"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
preload_app = True

# Timeouts
timeout = 120
keepalive = 2
graceful_timeout = 30

# Logging
accesslog = "/var/log/das/gunicorn_access.log"
errorlog = "/var/log/das/gunicorn_error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "das"

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190
```

## Backup and Recovery

### Backup Strategy

#### Full System Backup

```bash
#!/bin/bash
# /opt/das/scripts/full_backup.sh

BACKUP_DATE=$(date +%Y%m%d)
BACKUP_DIR="/opt/das/backups/full_$BACKUP_DATE"

mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U das_user das_production | gzip > $BACKUP_DIR/database.sql.gz

# Application files backup
tar -czf $BACKUP_DIR/application.tar.gz \
    --exclude='*.pyc' \
    --exclude='__pycache__' \
    --exclude='env/' \
    --exclude='*.log' \
    /opt/das/webserver

# Configuration backup
cp /opt/das/webserver/configs/config.toml $BACKUP_DIR/
cp /etc/nginx/sites-available/das $BACKUP_DIR/nginx.conf
cp /etc/systemd/system/das.service $BACKUP_DIR/

# Create backup manifest
echo "Backup created on $(date)" > $BACKUP_DIR/manifest.txt
echo "Database: $(du -h $BACKUP_DIR/database.sql.gz)" >> $BACKUP_DIR/manifest.txt
echo "Application: $(du -h $BACKUP_DIR/application.tar.gz)" >> $BACKUP_DIR/manifest.txt
```

#### Incremental Database Backup

```bash
#!/bin/bash
# /opt/das/scripts/incremental_backup.sh

BACKUP_DIR="/opt/das/backups/incremental"
mkdir -p $BACKUP_DIR

# WAL archiving setup (in postgresql.conf)
# archive_mode = on
# archive_command = 'cp %p /opt/das/backups/wal/%f'

# Create base backup
pg_basebackup -h localhost -U das_user -D $BACKUP_DIR/base -Ft -z -P
```

### Disaster Recovery

#### Recovery Procedures

```bash
#!/bin/bash
# Recovery procedure

# 1. Stop services
sudo systemctl stop das
sudo systemctl stop nginx
sudo systemctl stop postgresql

# 2. Restore database
sudo su - postgres
dropdb das_production
createdb das_production
gunzip -c /opt/das/backups/full_20240115/database.sql.gz | psql das_production

# 3. Restore application
cd /opt/das
sudo rm -rf webserver
sudo tar -xzf /opt/das/backups/full_20240115/application.tar.gz

# 4. Restore configuration
sudo cp /opt/das/backups/full_20240115/config.toml /opt/das/webserver/configs/
sudo cp /opt/das/backups/full_20240115/nginx.conf /etc/nginx/sites-available/das

# 5. Start services
sudo systemctl start postgresql
sudo systemctl start das
sudo systemctl start nginx
```

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check service status
sudo systemctl status das

# Check logs
journalctl -u das -f
tail -f /var/log/das/das.log

# Check socket file
ls -la /opt/das/das.sock
sudo chown das:das /opt/das/das.sock
```

#### Database Connection Issues

```bash
# Test connection
sudo su - das
psql -h localhost -U das_user -d das_production

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Check connections
sudo su - postgres
psql -c "SELECT * FROM pg_stat_activity WHERE datname='das_production';"
```

#### High Memory Usage

```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Check Django memory usage
python manage.py shell
>>> import psutil
>>> process = psutil.Process()
>>> print(f"Memory: {process.memory_info().rss / 1024 / 1024:.2f} MB")
```

#### Performance Issues

```bash
# Check database performance
sudo su - postgres
psql das_production -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check slow queries
tail -f /var/log/postgresql/postgresql-14-main.log | grep "duration:"

# Monitor system resources
htop
iotop
```

### Monitoring Scripts

#### System Health Check

```bash
#!/bin/bash
# /opt/das/scripts/health_check.sh

echo "=== DAS Health Check $(date) ==="

# Service status
echo "Services:"
systemctl is-active das nginx postgresql redis

# Disk usage
echo -e "\nDisk Usage:"
df -h | grep -E "(/$|/opt/das)"

# Memory usage
echo -e "\nMemory Usage:"
free -h

# Database status
echo -e "\nDatabase Connections:"
sudo su - postgres -c "psql -c \"SELECT count(*) FROM pg_stat_activity WHERE datname='das_production';\"" 2>/dev/null

# Application response
echo -e "\nApplication Response:"
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://localhost/health/

echo "=== End Health Check ==="
```

### Emergency Procedures

#### Service Recovery

```bash
#!/bin/bash
# Emergency service restart

echo "Emergency DAS recovery started..."

# Stop all services
sudo systemctl stop das nginx

# Clear socket file
sudo rm -f /opt/das/das.sock

# Check for hung processes
sudo pkill -f "gunicorn.*das"

# Start services
sudo systemctl start das
sleep 5
sudo systemctl start nginx

# Verify status
sudo systemctl status das nginx

echo "Recovery completed. Check service status above."
```

This deployment guide provides a comprehensive foundation for running DAS in production. Adapt the configurations based on your specific infrastructure requirements and security policies.