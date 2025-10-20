# Command Reference

Quick reference for running the Nginx Proxy Manager Switcher with custom configuration files.

## Basic Usage

```bash
node src/index.js [options]
```

## Command Line Options

| Option            | Short | Description                 | Example              |
| ----------------- | ----- | --------------------------- | -------------------- |
| `--config <file>` | `-c`  | Path to configuration file  | `-c ./my-config.yml` |
| `--help`          | `-h`  | Display help message        | `--help`             |
| `--version`       | `-v`  | Display version information | `--version`          |

## Common Usage Patterns

### Default Configuration

```bash
# Uses config_template.yml
node src/index.js
npm start
```

### Custom Configuration File

```bash
# Relative path
node src/index.js --config production.config.yml
node src/index.js -c ./my-config.yml

# Absolute path
node src/index.js --config /etc/nginx-proxy-switcher/config.yml
node src/index.js -c /opt/configs/production.yml
```

### Development Mode

```bash
# Default config with auto-restart
npm run dev

# Custom config with auto-restart
nodemon src/index.js --config development.config.yml
```

### Production Deployment

```bash
# Systemd service with custom config
ExecStart=/usr/bin/node /opt/nginx-proxy-switcher/src/index.js --config /etc/nginx-proxy-switcher/production.yml

# Docker with mounted config
docker run -v /host/config.yml:/app/config.yml myapp node src/index.js --config /app/config.yml
```

## Configuration File Examples

### Development Config

```yaml
# development.config.yml
sqlite_file: ./dev-database.db
nginx_conf_dir: ./nginx-configs
log_file: ./dev.log

services:
  test-service:
    domain: test.local
    check: http://localhost:3000/health
    interval: 5s
    error_delay: 10s
    if_success:
      host: localhost
      port: 3000
    if_failed:
      host: localhost
      port: 3001
```

### Production Config

```yaml
# production.config.yml
sqlite_file: /var/lib/nginx-proxy-manager/database.db
nginx_conf_dir: /etc/nginx/conf.d/proxy_host
log_file: /var/log/nginx-proxy-switcher.log

services:
  sso:
    domain: sso.company.com
    check: http://10.0.1.10:8000/health
    interval: 3s
    error_delay: 10s
    if_success:
      host: 10.0.1.10
      port: 8000
    if_failed:
      host: 10.0.1.11
      port: 8000
```

## Error Handling

### Invalid Config File

```bash
$ node src/index.js --config nonexistent.yml
Error: Configuration file not found: nonexistent.yml
```

### Invalid Command Line Option

```bash
$ node src/index.js --invalid-option
Error: Unknown option --invalid-option
Use --help for usage information
```

### Missing Config File Path

```bash
$ node src/index.js --config
Error: --config requires a file path
```

## Help and Version

### Display Help

```bash
node src/index.js --help
node src/index.js -h
```

### Display Version

```bash
node src/index.js --version
node src/index.js -v
```

## Environment Variables

You can also use environment variables for configuration:

```bash
# Set config file via environment variable
export CONFIG_FILE=/path/to/config.yml
node src/index.js --config $CONFIG_FILE

# Or use in scripts
CONFIG_FILE=production.yml node src/index.js --config $CONFIG_FILE
```

## Scripts in package.json

```json
{
  "scripts": {
    "start": "node src/index.js",
    "start:config": "node src/index.js --config",
    "dev": "nodemon src/index.js",
    "dev:config": "nodemon src/index.js --config"
  }
}
```

## Troubleshooting

### Config File Not Found

- Check file path is correct
- Ensure file has proper permissions
- Use absolute path if relative path doesn't work

### Invalid YAML Syntax

- Validate YAML syntax
- Check indentation (use 2 spaces)
- Ensure all required fields are present

### Permission Issues

- Ensure application has read access to config file
- Check file ownership and permissions
- Run with appropriate user privileges
