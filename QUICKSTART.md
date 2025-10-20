# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Create Configuration File

```bash
# Copy the example configuration
cp complete.config.example.yml production.config.yml

# Edit with your settings
nano production.config.yml
```

### 2. Update Configuration

Edit `production.config.yml` with your NPM paths and services:

```yaml
# Update these paths to match your NPM installation
sqlite_file: /data/database.db
nginx_conf_dir: /data/nginx/proxy_host

# Update nginx command to match your container name
nginx_refresh_cmd: docker exec nginx-proxy-manager-app-1 /usr/sbin/nginx -s reload

services:
  your-service:
    domain: your-domain.com
    check: http://your-server:port/health
    interval: 2s
    error_delay: 5s
    if_failed:
      host: your-fallback-server
      port: 80
```

### 3. Run with Docker Compose

```bash
# Copy the example docker-compose file
cp docker-compose.example.yml docker-compose.yml

# Update the NPM data path in docker-compose.yml
# Change: - /opt/npm/data:/data:rw
# To your actual NPM data path

# Start the service
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 4. Verify It's Working

```bash
# Check container status
docker-compose ps

# Check health
docker-compose exec nginx-proxy-manager-switcher node -e "console.log('OK')"

# View logs
docker-compose logs -f nginx-proxy-manager-switcher
```

## 🔧 Common NPM Data Paths

Update the volume path in `docker-compose.yml` based on your NPM installation:

```yaml
# Standard installation
- /opt/npm/data:/data:rw

# Docker Compose installation
- ./npm-data:/data:rw

# Docker volume
- /var/lib/docker/volumes/npm_data/_data:/data:rw

# Custom installation
- /path/to/your/npm/data:/data:rw
```

## 🐛 Troubleshooting

### Permission Issues

```bash
# Fix NPM data permissions
sudo chown -R 1000:1000 /path/to/npm/data

# Check your user ID
id -u
id -g
```

### Docker Socket Access

```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

### Configuration Issues

```bash
# Test configuration
docker-compose exec nginx-proxy-manager-switcher cat /app/production.config.yml

# Check if database exists
docker-compose exec nginx-proxy-manager-switcher ls -la /data/database.db
```

## 📚 Next Steps

1. **Monitor Logs**: `docker-compose logs -f`
2. **Test Health Checks**: Verify your health endpoints return 2xx
3. **Check Backups**: Look in `./backups/` directory
4. **Customize**: Adjust intervals and delays based on your needs

## 🆘 Need Help?

- Check the full README.md for detailed documentation
- Review the complete.config.example.yml for all options
- Check logs for error messages
- Ensure your NPM container name matches the nginx_refresh_cmd
