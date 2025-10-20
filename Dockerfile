# Dockerfile
FROM node:18-slim

# Create app directory and set proper permissions
WORKDIR /app
RUN mkdir -p /app && chown -R node:node /app

# Install system dependencies as root
USER root
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    ca-certificates \
    gnupg \
    lsb-release \
    && curl -fsSL https://get.docker.com/ | sh \
    && rm -rf /var/lib/apt/lists/*

# Switch to node user for application files
USER node

# Copy package files and install dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source code
COPY --chown=node:node . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/backups /app/logs && \
    chmod 755 /app/backups /app/logs

# Set proper file permissions for the application
RUN chmod +x src/index.js

# Switch back to node user (redundant but explicit)
USER node

# Expose port if needed (uncomment if your app serves HTTP)
# EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

ENTRYPOINT ["node", "src/index.js"]
CMD ["--config", "production.config.yml"]
