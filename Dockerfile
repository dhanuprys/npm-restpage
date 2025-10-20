# Dockerfile
FROM node:latest
WORKDIR /app
USER root

# This runs ONCE during the image build, not every time the container starts
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://get.docker.com/ | sh \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node package*.json ./
USER node
RUN npm ci
COPY --chown=node:node . .

ENTRYPOINT ["node", "src/index.js"]
CMD ["-c", "production.config.yml"]
