# Nginx Proxy Manager Switcher

An extended application for Nginx Proxy Manager that automatically switches proxy hosts and ports based on health checks. This application monitors configured services and automatically updates Nginx configurations when services become unavailable or recover.

## 🚀 Quick Start with Docker

The easiest way to use this application is with Docker. The image includes all dependencies and is ready to run.

### Prerequisites

- Docker and Docker Compose installed
- Access to Nginx Proxy Manager's database and configuration files
- Docker socket access for executing nginx commands

### Basic Usage

1. **Create a configuration file:**

```yaml
# production.config.yml
sqlite_file: /data/database.db
nginx_conf_dir: /data/nginx/proxy_host
log_file: /var/log/host_switcher.log
backup_dir: /app/backups

# Command to reload Nginx configuration
nginx_refresh_cmd: docker exec nginx-proxy-manager-app-1 /usr/sbin/nginx -s reload

services:
  sso:
    domain: sso.example.com
    check: http://192.168.11.1:8000/health
    interval: 2s
    error_delay: 5s
    if_failed:
      host: 192.168.13.1
      port: 80
      scheme: http
```

2. **Run with Docker:**

```bash
docker run -d \
  --name nginx-switcher \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /path/to/npm/data:/data:rw \
  -v ./production.config.yml:/app/production.config.yml:ro \
  -v ./backups:/app/backups:rw \
  dhanuprys/npm-restpage:latest
```

## 🐳 Docker Compose Setup

For easier management, use Docker Compose:

### Complete Docker Compose Example

```yaml
# docker-compose.yml
version: '3.8'

services:
  nginx-proxy-manager-switcher:
    image: dhanuprys/npm-restpage:latest
    container_name: nginx-switcher
    restart: unless-stopped

    # Configuration
    command: ['--config', 'production.config.yml']

    # User and permissions
    user: '1000:1000' # Adjust UID:GID as needed

    # Volumes
    volumes:
      # Docker socket for executing nginx commands
      - /var/run/docker.sock:/var/run/docker.sock:ro

      # NPM data directory (adjust path to your NPM data)
      - /opt/npm/data:/data:rw

      # Configuration file
      - ./production.config.yml:/app/production.config.yml:ro

      # Backup directory
      - ./backups:/app/backups:rw

      # Logs directory
      - ./logs:/app/logs:rw

    # Environment variables
    environment:
      - NODE_ENV=production
      - TZ=UTC

    # Health check
    healthcheck:
      test: ['CMD', 'node', '-e', "console.log('Health check passed')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # Logging
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

### Start the Service

```bash
# Start the switcher
docker-compose up -d

# View logs
docker-compose logs -f nginx-proxy-manager-switcher

# Stop the service
docker-compose down
```

## 📋 Configuration Guide

### Global Settings

- `sqlite_file`: Path to the SQLite database file (usually `/data/database.db`)
- `nginx_conf_dir`: Directory where Nginx proxy configurations are stored (usually `/data/nginx/proxy_host`)
- `log_file`: Path to the application log file
- `nginx_refresh_cmd`: Command to reload Nginx configuration
- `backup_dir`: Directory for storing proxy_host backups (optional, defaults to `./backups`)

### Service Configuration

Each service requires the following configuration:

- `domain`: Domain name for the service (must match Nginx Proxy Manager configuration)
- `check`: HTTP URL to check for service health (must return 2xx status code)
- `interval`: Time between health checks when service is UP (e.g., "2s", "5m")
- `error_delay`: Time to wait before retrying after a check fails
- `retries`: **Optional** number of retry attempts before marking as failed (defaults to 3, range: 1-10)
- `if_failed`: Fallback upstream server configuration when health check fails
- `if_success`: **Optional** upstream server configuration when health check succeeds

#### Scheme Support

Both `if_success` and `if_failed` configurations now support an optional `scheme` property:

- `scheme`: **Optional** forward scheme ('http' or 'https')
- If not provided, the application will use the original scheme from the database
- If provided, it will override the scheme when switching configurations

#### Retry Configuration

The application supports configurable retry attempts for health checks:

- **Default Retries**: 3 attempts if not specified
- **Configurable Range**: 1 to 10 retries
- **Retry Delay**: 1 second between retry attempts
- **Smart Logging**: Logs each retry attempt with progress

**Retry Strategy:**

- **Reduces False Positives**: Transient network issues won't trigger failover
- **Configurable per Service**: Critical services can have more retries
- **Quick Failover**: Services can have fewer retries for faster detection

**Examples:**

```yaml
# Quick failover - fail fast
retries: 1

# Balanced approach (default)
retries: 3

# Critical service - more tolerance
retries: 5

# Maximum stability
retries: 10
```

#### Simplified Configuration Approach

The application now uses a **simplified approach** that eliminates the need to configure `if_success` in most cases:

- **Automatic Success Configuration**: Uses original configuration from database
- **Only Configure Fallback**: You typically only need to specify `if_failed`
- **Reduced Complexity**: Less configuration required

This means you typically only need to configure the `if_failed` fallback server!

#### Configuration Examples

**Minimal Configuration (Recommended):**

```yaml
services:
  sso:
    domain: sso.example.com
    check: http://192.168.11.1:8000/health
    interval: 2s
    error_delay: 5s
    # Only configure the fallback - original config comes from database
    if_failed:
      host: 192.168.13.1
      port: 80
      scheme: http # Optional: http or https
```

**With Custom Success Configuration:**

```yaml
services:
  sso:
    domain: sso.example.com
    check: http://192.168.11.1:8000/health
    interval: 2s
    error_delay: 5s
    # Override the original config from database
    if_success:
      host: 192.168.11.1
      port: 8000
      scheme: https # Optional: http or https
    if_failed:
      host: 192.168.13.1
      port: 80
      scheme: http # Optional: http or https
```

**Mixed Scheme Configuration:**

```yaml
services:
  api:
    domain: api.example.com
    check: http://192.168.20.10:3000/health
    interval: 3s
    error_delay: 8s
    # Use HTTPS for fallback, original config from database for success
    if_failed:
      host: 192.168.20.11
      port: 3000
      scheme: https # Fallback uses HTTPS
```

### nginx_refresh_cmd Examples

The `nginx_refresh_cmd` property allows you to customize how Nginx is reloaded. This is useful for different deployment scenarios:

```yaml
# Default (if not specified)
nginx_refresh_cmd: /usr/sbin/nginx -s reload

# Custom nginx binary location
nginx_refresh_cmd: /usr/local/bin/nginx -s reload

# Docker container
nginx_refresh_cmd: docker exec nginx-container nginx -s reload

# Systemd service
nginx_refresh_cmd: systemctl reload nginx

# Docker Compose
nginx_refresh_cmd: docker-compose exec nginx nginx -s reload

# Kubernetes
nginx_refresh_cmd: kubectl exec nginx-pod -- nginx -s reload

# With sudo
nginx_refresh_cmd: sudo /usr/sbin/nginx -s reload

# Custom nginx binary location
nginx_refresh_cmd: /usr/local/bin/nginx -s reload
```

**Note:** The application automatically generates the corresponding test command by replacing `-s reload` with `-t`. For example:

- `docker exec app /usr/sbin/nginx -s reload` → `docker exec app /usr/sbin/nginx -t`
- `systemctl reload nginx` → `systemctl reload nginx -t`

### Backup System

The application automatically creates backups of initial proxy_host configurations:

- **Automatic Backup**: Creates JSON backups when services are initialized
- **Timestamped Files**: Each backup includes a timestamp in the filename
- **Complete Data**: Backups include all proxy_host fields (id, domain_names, forward_host, forward_port, forward_scheme, enabled)
- **Metadata**: Each backup includes metadata about the backup type and description

**Backup File Format:**

```json
{
  "timestamp": "2025-01-20T12:30:45.123Z",
  "serviceName": "sso",
  "proxyHost": {
    "id": 1,
    "domain_names": "[\"sso.example.com\"]",
    "forward_host": "192.168.11.2",
    "forward_port": 8010,
    "forward_scheme": "http",
    "enabled": 1
  },
  "metadata": {
    "backupType": "initial",
    "description": "Initial proxy_host configuration before any modifications"
  }
}
```

**Backup Directory Examples:**

```yaml
# Default backup directory
backup_dir: ./backups

# Production backup directory
backup_dir: /var/backups/nginx-proxy-manager

# Docker volume backup directory
backup_dir: /data/backups
```

## 🛠️ Development Setup

If you want to run the application locally for development:

### Prerequisites

- Node.js 18+
- Access to Nginx Proxy Manager database
- curl for health checks

### Installation

1. **Clone and install:**

```bash
git clone <repository-url>
cd nginx-proxy-manager-switcher
npm install
```

2. **Create configuration:**

```bash
cp example.config.yml my-config.yml
# Edit my-config.yml with your settings
```

3. **Run the application:**

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start

# With custom config
npm run start:config my-config.yml
```

### Available Scripts

```bash
npm start              # Start the application
npm run dev            # Start in development mode with auto-restart
npm run start:config   # Start with custom config file
npm run dev:config     # Development mode with custom config
npm test               # Run tests
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run format         # Format code with Prettier
npm run check          # Run linting and formatting checks
npm run fix            # Fix all linting and formatting issues
```

## 📊 Monitoring and Logs

### Viewing Logs

**Docker Compose:**

```bash
# View all logs
docker-compose logs -f

# View only switcher logs
docker-compose logs -f nginx-proxy-manager-switcher

# View last 100 lines
docker-compose logs --tail=100 nginx-proxy-manager-switcher
```

**Docker:**

```bash
# View logs
docker logs -f nginx-switcher

# View last 100 lines
docker logs --tail=100 nginx-switcher
```

### Log Levels

The application provides detailed logging with different levels:

- **INFO**: General information and successful operations
- **SUCCESS**: Successful health checks and configuration updates
- **WARN**: Non-critical issues and warnings
- **ERROR**: Errors and failed operations
- **DEBUG**: Detailed debugging information

### Health Monitoring

The Docker container includes health checks:

```bash
# Check container health
docker ps
# Look for "healthy" status

# Manual health check
docker exec nginx-switcher node -e "console.log('Health check passed')"
```

## 🔧 Troubleshooting

### Common Issues

**1. Socket Hang-up Errors:**

The application is configured to prevent socket hang-up issues:

- **Keep-Alive Disabled**: Each health check creates a fresh connection
- **Connection: close Header**: Explicitly closes connections after requests
- **Timeout Settings**: Prevents indefinite waiting
- **Works Like curl**: Behaves the same way as curl commands

If you still experience hang-ups, check:

```bash
# Test your health endpoint with curl
curl -v http://your-service:port/health

# Check server logs for connection issues
docker logs your-service-container
```

**2. Permission Denied Errors:**

```bash
# Check file permissions
ls -la /path/to/npm/data/

# Fix permissions (adjust UID:GID)
sudo chown -R 1000:1000 /path/to/npm/data/
```

**2. Docker Socket Access:**

```bash
# Check if user is in docker group
groups $USER

# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

**3. Configuration File Not Found:**

```bash
# Check if config file exists and is readable
docker exec nginx-switcher cat /app/production.config.yml
```

**4. Database Connection Issues:**

```bash
# Check if database file exists
docker exec nginx-switcher ls -la /data/database.db

# Check database permissions
docker exec nginx-switcher ls -la /data/
```

### Debug Mode

Enable debug logging by setting the log level in your configuration:

```yaml
# Add to your config file
log_level: debug
```

Or set environment variable:

```bash
docker run -e LOG_LEVEL=debug dhanuprys/npm-restpage:latest
```

## 🏗️ Architecture

The application follows a clean architecture pattern with the following components:

- **ConfigLoader**: Handles YAML configuration loading and validation
- **DatabaseManager**: Manages SQLite database connections and operations
- **HealthChecker**: Performs HTTP health checks using curl
- **NginxConfigUpdater**: Updates Nginx configuration files and reloads Nginx
- **ServiceManager**: Orchestrates health checks, database updates, and Nginx reloads
- **Logger**: Provides colorful console and file logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run check`
6. Commit your changes: `git commit -m 'Add feature'`
7. Push to the branch: `git push origin feature-name`
8. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Review the logs for error messages
3. Check the GitHub issues for similar problems
4. Create a new issue with detailed information about your setup

## 🙏 Acknowledgments

- Built for Nginx Proxy Manager
- Uses SQLite for database operations
- Integrates with Docker for nginx command execution
