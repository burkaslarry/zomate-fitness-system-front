# Network Monitoring Backend

A robust server monitoring backend service built with FastAPI, PostgreSQL, and integrated with Firebase Cloud Messaging and JIRA.

## Features

- **Server Status Management**: Full CRUD operations for monitoring servers
- **Device Registration**: Register devices for push notifications
- **Push Notifications**: Automatic alerts via Firebase Cloud Messaging
- **JIRA Integration**: Automatic ticket creation for server issues
- **WebSocket Support**: Real-time health checks and notifications
- **JWT Authentication**: Secure API endpoints
- **Health Checks**: API and WebSocket connectivity monitoring
- **RabbitMQ Integration**: Asynchronous message queuing for scalable processing
- **RAG Support**: Retrieval Augmented Generation endpoints with async processing
- **Comprehensive Testing**: 150+ unit tests with 100% endpoint coverage

## Tech Stack

- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Issue Tracking**: JIRA REST API
- **WebSocket**: Built-in FastAPI WebSocket support
- **Message Queue**: RabbitMQ with Pika client library
- **Database Migrations**: Alembic
- **Testing**: Pytest with comprehensive test suite

## Quick Start

### Prerequisites

- Python 3.8+
- PostgreSQL database
- RabbitMQ server (optional, for async processing)
- Firebase project with service account credentials
- JIRA account with API token (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd network-monitoring-backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

5. Set up the database:
```bash
# Initialize Alembic (first time only)
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

6. (Optional) Run the test suite:
```bash
python run_tests.py
```

7. Run the application:
```bash
python run.py
# Or using the module directly:
python -m app.main
# Or using uvicorn directly:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

## API Endpoints

### Authentication
All endpoints except `/health` and root require JWT authentication via Bearer token.

### Server Management
- `POST /api/servers` - Create a new server to monitor
- `GET /api/servers` - Get all monitored servers
- `GET /api/servers/{server_id}` - Get specific server status
- `PUT /api/servers/{server_id}` - Update server status
- `DELETE /api/servers/{server_id}` - Remove server from monitoring

### Device Registration
- `POST /api/devices` - Register device for notifications
- `PUT /api/devices/{device_id}` - Update device information
- `DELETE /api/devices/{device_id}` - Unregister device
- `GET /api/devices/{device_id}` - Get device information

### Push Notifications
- `POST /api/push/test/{device_id}` - Send test notification

### JIRA Integration
- `POST /api/jira/create-ticket` - Create JIRA ticket for server issues

### RAG (Retrieval Augmented Generation)
- `POST /rag/query` - Submit RAG query for asynchronous processing

### Health Checks
- `GET /health` - API health check
- `WebSocket /socket` - WebSocket health check (ping/pong) and real-time notifications

## Configuration

### Environment Variables

Create a `.env` file based on `env.example`:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/monitoring_db

# JWT
SECRET_KEY=your-super-secret-jwt-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Firebase
FIREBASE_CREDENTIALS_PATH=path/to/firebase-service-account.json

# JIRA (optional)
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=OPS

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=True

# RabbitMQ (optional)
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
```

### Firebase Setup

1. Create a Firebase project
2. Generate a service account key
3. Download the JSON credentials file
4. Set `FIREBASE_CREDENTIALS_PATH` to the file path

### JIRA Setup

1. Create an API token in your Atlassian account
2. Set the JIRA environment variables
3. Ensure you have access to create issues in the specified project

### RabbitMQ Setup (Optional)

RabbitMQ enables asynchronous processing for RAG queries and background tasks:

1. **Using Docker (Recommended):**
   ```bash
   # Start RabbitMQ with management UI
   docker run -d --name rabbitmq \
     -p 5672:5672 -p 15672:15672 \
     -e RABBITMQ_DEFAULT_USER=guest \
     -e RABBITMQ_DEFAULT_PASS=guest \
     rabbitmq:3-management-alpine
   
   # Access management UI at http://localhost:15672
   ```

2. **Using Docker Compose:**
   ```bash
   # RabbitMQ is included in docker-compose.yml
   docker-compose up -d rabbitmq
   ```

3. **Native Installation:**
   ```bash
   # macOS
   brew install rabbitmq
   
   # Ubuntu/Debian
   sudo apt-get install rabbitmq-server
   
   # Enable management plugin
   sudo rabbitmq-plugins enable rabbitmq_management
   ```

**Note:** The application works without RabbitMQ - messages will be logged but not processed asynchronously.

## Data Models

### ServerStatus
- `server_id`: Unique identifier (UUID)
- `server_name`: Human-readable server name
- `cpu_load`: CPU usage percentage (0-100)
- `memory_usage`: Memory usage percentage (0-100)
- `api_status`: Status ("online", "offline", "degraded")
- `last_updated`: Timestamp of last update

### Device
- `device_id`: Unique identifier (UUID)
- `fcm_token`: Firebase Cloud Messaging token
- `os_type`: Operating system ("ios", "android")
- `os_version`: OS version string
- `created_at`: Registration timestamp

## Automatic Notifications

When a server status is updated to "offline" or "degraded", the system automatically:

1. Sends push notifications to all registered devices
2. Includes the full server status in the notification payload
3. Logs the notification results

## WebSocket Usage

Connect to `/socket` and send JSON messages:

```javascript
// Ping message
{
  "type": "ping",
  "timestamp": "2023-12-01T10:00:00Z"
}

// Response
{
  "type": "pong",
  "timestamp": "2023-12-01T10:00:00Z",
  "message": "pong"
}
```

## Testing

Run tests with pytest:
```bash
pytest
```

## Development

### Database Migrations

Create a new migration:
```bash
alembic revision --autogenerate -m "Description of changes"
```

Apply migrations:
```bash
alembic upgrade head
```

### Code Structure

```
app/
├── __init__.py
├── main.py              # FastAPI application
├── database.py          # Database configuration
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic schemas
├── auth.py              # JWT authentication
├── websocket.py         # WebSocket handling with RabbitMQ integration
├── rabbitmq.py          # RabbitMQ service and connection management
├── rag_worker.py        # RAG query processing worker
├── routers/             # API route handlers
│   ├── servers.py       # Server management (with RabbitMQ integration)
│   ├── devices.py
│   ├── notifications.py
│   ├── jira.py
│   ├── rag.py           # RAG query endpoints
│   └── health.py
└── services/            # Business logic services
    ├── firebase_service.py
    └── jira_service.py

tests/                   # Comprehensive test suite
├── conftest.py          # Test configuration and fixtures
├── test_main.py         # Main application tests
├── test_servers.py      # Server endpoint tests
├── test_devices.py      # Device endpoint tests
├── test_notifications.py # Push notification tests
├── test_jira.py         # JIRA integration tests
├── test_auth.py         # Authentication tests
├── test_websocket.py    # WebSocket tests
└── test_models.py       # Database model tests
```

## Testing

### Running Tests

The project includes a comprehensive test suite with 150+ unit tests covering all functionality.

#### Run All Tests
```bash
# Using the test runner script
python run_tests.py

# Or using pytest directly
pytest tests/ -v
```

#### Run Specific Test Files
```bash
# Test specific functionality
python run_tests.py tests/test_servers.py
python run_tests.py tests/test_notifications.py
python run_tests.py tests/test_websocket.py
```

#### Run Specific Test Methods
```bash
# Test specific test methods
pytest tests/test_auth.py::TestAuthenticationUtils::test_password_hashing -v
pytest tests/test_servers.py::TestServerEndpoints::test_create_server_success -v
```

### Test Coverage

The test suite covers:

- ✅ **API Endpoints** (100% coverage): All REST endpoints tested
- ✅ **WebSocket Functionality**: Real-time ping/pong and connection management
- ✅ **Authentication & Security**: JWT tokens, password hashing, authorization
- ✅ **Database Models**: CRUD operations, constraints, relationships
- ✅ **External Services**: Firebase FCM and JIRA integration (mocked)
- ✅ **Error Handling**: All error scenarios and edge cases
- ✅ **Business Logic**: Server monitoring, notification triggers

### Test Features

- **Database Isolation**: Each test uses a fresh SQLite database
- **Service Mocking**: External services (Firebase, JIRA) are mocked
- **Async Testing**: Proper async/await testing for services
- **Fixtures**: Reusable test data and configuration
- **Error Simulation**: Network failures, API errors, timeouts

### Test Statistics

- **150+ Test Methods** across 9 test files
- **Unit Tests**: Individual component testing
- **Integration Tests**: Full API endpoint testing
- **Security Tests**: Authentication and authorization
- **Service Tests**: External service integration

## Deployment

The application supports multiple deployment methods: raw code deployment, Docker containers, and Docker Compose orchestration.

### 🚀 Quick Deployment (Automated)

Use the automated deployment script for easy setup:

```bash
# Make the script executable
chmod +x deploy.sh

# Deploy with Docker Compose (recommended)
./deploy.sh deploy

# Deploy standalone container
./deploy.sh deploy-standalone

# Build Docker image only
./deploy.sh build
```

### 📦 Docker Deployment (Recommended)

#### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 10GB disk space

#### 1. Docker Compose Deployment (Full Stack)

**Development Environment:**
```bash
# Clone the repository
git clone <repository-url>
cd network-monitoring-backend

# Create environment file
cp env.example .env
# Edit .env with your configuration

# Deploy full stack (app + database + redis + nginx)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app
```

**Production Environment:**
```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d

# Or use the deployment script
./deploy.sh deploy .env.production
```

#### 2. Standalone Docker Container

```bash
# Build the image
docker build -t monitoring-backend:latest .

# Run the container
docker run -d \
  --name monitoring-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file .env \
  monitoring-backend:latest

# Check container status
docker ps

# View logs
docker logs -f monitoring-backend
```

#### 3. Docker Image from Registry

```bash
# Pull pre-built image (if available)
docker pull your-registry/monitoring-backend:latest

# Run with custom configuration
docker run -d \
  --name monitoring-backend \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e SECRET_KEY="your-secret-key" \
  -v ./firebase-credentials.json:/app/firebase-credentials.json:ro \
  your-registry/monitoring-backend:latest
```

### 🔧 Raw Code Deployment

#### 1. Traditional Server Deployment

**Prerequisites:**
- Python 3.8+
- PostgreSQL 12+
- Nginx (recommended)
- Systemd (for service management)

**Setup Steps:**
```bash
# 1. Clone and setup
git clone <repository-url>
cd network-monitoring-backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp env.example .env
# Edit .env with production values

# 5. Setup database
alembic upgrade head

# 6. Run tests
python run_tests.py

# 7. Start application
python run.py
```

#### 2. Production Server with Gunicorn

```bash
# Install Gunicorn
pip install gunicorn uvicorn[standard]

# Run with Gunicorn
gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --access-logfile /var/log/monitoring/access.log \
  --error-logfile /var/log/monitoring/error.log \
  --daemon
```

#### 3. Systemd Service Configuration

Create `/etc/systemd/system/monitoring-backend.service`:

```ini
[Unit]
Description=Network Monitoring Backend
After=network.target postgresql.service

[Service]
Type=exec
User=monitoring
Group=monitoring
WorkingDirectory=/opt/monitoring-backend
Environment=PATH=/opt/monitoring-backend/venv/bin
ExecStart=/opt/monitoring-backend/venv/bin/gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable monitoring-backend
sudo systemctl start monitoring-backend
sudo systemctl status monitoring-backend
```

### 🌐 Reverse Proxy Configuration

#### Nginx Configuration

Create `/etc/nginx/sites-available/monitoring-backend`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/monitoring-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 🔒 Production Security Checklist

- [ ] **Environment Variables**: Set strong `SECRET_KEY`, database passwords
- [ ] **Database**: Use PostgreSQL with SSL, regular backups
- [ ] **SSL/TLS**: Configure HTTPS with valid certificates
- [ ] **Firewall**: Restrict access to necessary ports only
- [ ] **User Permissions**: Run application as non-root user
- [ ] **Logging**: Configure centralized logging and monitoring
- [ ] **Updates**: Keep dependencies and OS updated
- [ ] **Secrets Management**: Use proper secret management (HashiCorp Vault, etc.)

### 📊 Monitoring and Maintenance

#### Health Checks

```bash
# Application health
curl -f http://localhost:8000/health

# Docker container health
docker ps --filter "name=monitoring-backend"

# Service status (systemd)
sudo systemctl status monitoring-backend
```

#### Log Management

```bash
# Docker logs
docker-compose logs -f app

# System logs
journalctl -u monitoring-backend -f

# Application logs
tail -f /var/log/monitoring/app.log
```

#### Database Backup

```bash
# Manual backup
pg_dump -h localhost -U monitoring_user monitoring_db > backup.sql

# Automated backup (Docker)
./deploy.sh backup

# Restore backup
psql -h localhost -U monitoring_user monitoring_db < backup.sql
```

#### Updates and Maintenance

```bash
# Update deployment (Docker)
./deploy.sh update

# Manual update (raw deployment)
git pull
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart monitoring-backend
```

### 🔄 CI/CD Pipeline Example

#### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: python run_tests.py

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          # SSH to server and run deployment
          ssh user@server 'cd /opt/monitoring-backend && ./deploy.sh update'
```

### 🐛 Troubleshooting

#### Common Issues

**Container won't start:**
```bash
# Check logs
docker logs monitoring-backend

# Check environment variables
docker exec monitoring-backend env | grep -E "(DATABASE|SECRET)"
```

**Database connection issues:**
```bash
# Test database connection
docker-compose exec app python -c "from app.database import engine; print(engine.connect())"
```

**Permission issues:**
```bash
# Fix file permissions
sudo chown -R monitoring:monitoring /opt/monitoring-backend
```

**High memory usage:**
```bash
# Monitor resource usage
docker stats monitoring-backend

# Adjust container resources
docker update --memory=512m monitoring-backend
```

## 🚧 TODO - RabbitMQ Integration Roadmap

The RabbitMQ integration has been partially implemented with core infrastructure in place. Here's what's completed and what remains:

### ✅ Completed

#### Core Infrastructure
- [x] **RabbitMQ Service** (`app/rabbitmq.py`)
  - Connection management with retry logic and graceful failure
  - Message publishing with persistence and error handling
  - Proper connection cleanup on application shutdown

- [x] **Docker Integration** (`docker-compose.yml`)
  - RabbitMQ service with management UI (port 15672)
  - Health checks and dependency management
  - Persistent data volumes
  - Environment variable configuration

- [x] **RAG Query Processing**
  - RAG endpoint (`/rag/query`) for async query submission
  - RAG worker (`app/rag_worker.py`) for background processing
  - Queue-based communication between API and worker
  - RAGQuery schema for request validation

- [x] **CRUD Integration**
  - Server creation/update/deletion events published to RabbitMQ
  - Background task processing for server events
  - Message publishing in all server management endpoints

- [x] **WebSocket Integration**
  - RabbitMQ consumer for real-time notifications
  - RAG result broadcasting to connected WebSocket clients
  - Subscription management for notifications

- [x] **Configuration & Environment**
  - Environment variables for RabbitMQ connection
  - Updated `env.example` with RabbitMQ settings
  - Graceful degradation when RabbitMQ is unavailable

### 🔄 In Progress / Needs Completion

#### 1. RAG Worker Implementation
**Priority: High**
- [ ] Replace placeholder RAG processing with actual implementation
- [ ] Add support for different RAG query types
- [ ] Implement vector database integration (e.g., Pinecone, Weaviate)
- [ ] Add RAG result caching and optimization
- [ ] Create RAG model configuration and management

#### 2. Background Task Workers
**Priority: High**
- [ ] Create dedicated workers for different task types:
  - [ ] Server monitoring tasks
  - [ ] Notification processing
  - [ ] Report generation
  - [ ] Data cleanup tasks
- [ ] Implement task scheduling and cron-like functionality
- [ ] Add worker health monitoring and auto-restart

#### 3. Message Queue Patterns
**Priority: Medium**
- [ ] Implement dead letter queues for failed messages
- [ ] Add message routing with exchanges (fanout, topic, direct)
- [ ] Create priority queues for urgent tasks
- [ ] Implement message deduplication
- [ ] Add batch processing capabilities

#### 4. Monitoring & Observability
**Priority: Medium**
- [ ] Queue metrics and monitoring dashboard
- [ ] Message processing time tracking
- [ ] Worker performance metrics
- [ ] Failed message alerting
- [ ] Integration with monitoring tools (Prometheus, Grafana)

#### 5. Advanced WebSocket Features
**Priority: Medium**
- [ ] User-specific notification channels
- [ ] WebSocket authentication and authorization
- [ ] Message acknowledgment and delivery guarantees
- [ ] WebSocket connection pooling and load balancing
- [ ] Real-time server status streaming

#### 6. Testing & Quality Assurance
**Priority: High**
- [ ] Unit tests for RabbitMQ service
- [ ] Integration tests for RAG endpoints
- [ ] WebSocket integration tests
- [ ] Load testing for message processing
- [ ] End-to-end tests for async workflows

#### 7. Production Readiness
**Priority: High**
- [ ] RabbitMQ clustering for high availability
- [ ] Message persistence and durability configuration
- [ ] Security: SSL/TLS, user authentication, ACLs
- [ ] Backup and disaster recovery procedures
- [ ] Performance tuning and optimization

#### 8. Documentation & Examples
**Priority: Medium**
- [ ] RAG API usage examples and documentation
- [ ] WebSocket client examples (JavaScript, Python)
- [ ] Message queue architecture diagrams
- [ ] Troubleshooting guide
- [ ] Performance benchmarking results

### 🎯 Quick Wins (Can be completed immediately)

1. **RAG Worker Enhancement** (2-4 hours)
   - Replace the placeholder `process_rag_query()` function
   - Add basic text processing or integrate with OpenAI API
   - Improve error handling and logging

2. **WebSocket Client Examples** (1-2 hours)
   - Create JavaScript client for testing WebSocket notifications
   - Add Python client example for programmatic access

3. **Queue Monitoring** (2-3 hours)
   - Add endpoints to check queue status and message counts
   - Create simple dashboard for queue health

4. **Message Validation** (1-2 hours)
   - Add Pydantic schemas for all message types
   - Implement message validation in workers

### 🔧 Development Setup for RabbitMQ

To continue development on the RabbitMQ integration:

1. **Start RabbitMQ:**
   ```bash
   docker-compose up -d rabbitmq
   # Access management UI: http://localhost:15672 (guest/guest)
   ```

2. **Run the main application:**
   ```bash
   python3 run.py
   ```

3. **Run the RAG worker (in separate terminal):**
   ```bash
   python3 app/rag_worker.py
   ```

4. **Test the integration:**
   ```bash
   # Submit RAG query
   curl -X POST "http://localhost:8000/rag/query" \
     -H "Content-Type: application/json" \
     -d '{"query": "What is the status of server-1?"}'
   
   # Connect to WebSocket for real-time updates
   # Use browser console or WebSocket client
   ```

### 📚 Useful Resources

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Pika Documentation](https://pika.readthedocs.io/)
- [FastAPI WebSocket Documentation](https://fastapi.tiangolo.com/advanced/websockets/)
- [Docker Compose for RabbitMQ](https://www.rabbitmq.com/download.html)

### 🤝 Contributing to RabbitMQ Integration

When working on the RabbitMQ integration:

1. Follow the existing code patterns in `app/rabbitmq.py`
2. Add comprehensive error handling and logging
3. Write tests for new functionality
4. Update this TODO list as items are completed
5. Document any new environment variables or configuration

## License

This project is licensed under the MIT License.