# Nginx Proxy Manager Switcher

An extended application for Nginx Proxy Manager that automatically switches proxy hosts and ports based on health checks. This application monitors configured services and automatically updates Nginx configurations when services become unavailable or recover.

## Features

- **Automatic Health Monitoring**: Performs HTTP health checks on configured services
- **Dynamic Proxy Switching**: Automatically switches between primary and fallback upstream servers
- **SQLite Integration**: Reads and updates Nginx Proxy Manager database
- **Nginx Configuration Management**: Updates and reloads Nginx configurations
- **Comprehensive Logging**: Colorful console and file logging with detailed event tracking
- **Clean Architecture**: Modular design with separation of concerns
- **Error Handling**: Robust error handling and recovery mechanisms

## Installation

1. Install Node.js dependencies:
```bash
npm install
```

2. Configure your services in `config_template.yml`:
```yaml
sqlite_file: /data/database.db
nginx_conf_dir: /data/nginx/proxy_host
log_file: /var/log/host_switcher.log

services:
  sso:
    domain: sso.example.com
    check: http://192.168.11.1:8000/up
    interval: 2s
    error_delay: 5s
    if_success:
      host: 192.168.11.1
      port: 8000
    if_failed:
      host: 192.168.13.1
      port: 80
```

3. Run the application:
```bash
npm start
```

## Configuration

### Global Settings

- `sqlite_file`: Path to the SQLite database file
- `nginx_conf_dir`: Directory where Nginx proxy configurations are stored
- `log_file`: Path to the application log file

### Service Configuration

Each service requires the following configuration:

- `domain`: Domain name for the service (must match Nginx Proxy Manager configuration)
- `check`: HTTP URL to check for service health (must return 2xx status code)
- `interval`: Time between health checks when service is UP (e.g., "2s", "5m")
- `error_delay`: Time to wait before retrying after a check fails
- `if_success`: Upstream server configuration when health check succeeds
- `if_failed`: Fallback upstream server configuration when health check fails

## Architecture

The application follows a clean architecture pattern with the following components:

- **ConfigLoader**: Handles YAML configuration loading and validation
- **Logger**: Provides colorful logging with file and console output
- **DatabaseManager**: Manages SQLite database operations
- **HealthChecker**: Performs HTTP health checks on services
- **NginxConfigUpdater**: Updates Nginx configuration files and reloads Nginx
- **ServiceManager**: Main orchestrator that coordinates all components
- **Application**: Main entry point and lifecycle management

## Database Schema

The application works with the Nginx Proxy Manager SQLite database, specifically the `proxy_host` table:

- `id`: Unique identifier
- `domain_names`: JSON array of domain names
- `forward_host`: Current forward host
- `forward_port`: Current forward port
- `forward_scheme`: Forward scheme (http/https)
- `enabled`: Whether the proxy is enabled

## Nginx Configuration Format

The application is designed to work with Nginx Proxy Manager's configuration format, which uses variables:

```nginx
server {
  set $forward_scheme http;
  set $server         "192.168.11.2";
  set $port           8010;
  
  # ... other configuration ...
  
  location / {
    proxy_pass $forward_scheme://$server:$port;
    # ... other proxy settings ...
  }
}
```

The application will update the `set $server` and `set $port` directives when switching between primary and fallback servers.

## Logging

The application provides comprehensive logging with:

- **Console Output**: Colorful, formatted logs for development and monitoring
- **File Output**: JSON-formatted logs for production analysis
- **Log Levels**: Debug, Info, Warn, Error, and Success
- **Service Context**: Each log entry includes service context when applicable
- **Health Check Results**: Detailed health check results with response times
- **Configuration Changes**: Logs all proxy configuration updates

## Error Handling

The application includes robust error handling:

- **Database Connection Errors**: Graceful handling of database connectivity issues
- **Health Check Failures**: Proper handling of network timeouts and connection errors
- **Nginx Configuration Errors**: Validation and rollback capabilities
- **Service Initialization Errors**: Clear error messages and graceful shutdown

## Development

### Code Style

This project uses Prettier for code formatting and ESLint for code quality. The code style is automatically enforced through pre-commit hooks.

```bash
# Format code
npm run format              # Format src/ files
npm run format:all          # Format all files

# Lint code
npm run lint                # Lint src/ files
npm run lint:fix            # Fix linting issues

# Check formatting
npm run format:check        # Check src/ formatting
npm run format:check:all    # Check all files

# Combined checks
npm run check               # Lint + format check
npm run fix                 # Lint fix + format
```

See [CODE_STYLE.md](CODE_STYLE.md) for detailed coding standards and best practices.

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for automatic restart on file changes.

### Testing

```bash
npm test
```

## Requirements

- Node.js 14 or higher
- Nginx with reload capability
- SQLite3 database
- Access to Nginx Proxy Manager database
- Appropriate file system permissions for configuration updates

## Security Considerations

- Ensure the application runs with appropriate permissions
- Validate all configuration inputs
- Use secure file permissions for configuration files
- Monitor log files for security events

## Troubleshooting

### Common Issues

1. **Database Connection Failed**: Check SQLite file path and permissions
2. **Nginx Reload Failed**: Ensure the application has permission to reload Nginx
3. **Configuration File Not Found**: Verify the Nginx configuration directory path
4. **Health Check Timeout**: Check network connectivity and service availability

### Debug Mode

Enable debug logging by setting the log level to debug in the logger configuration.

## License

MIT License
