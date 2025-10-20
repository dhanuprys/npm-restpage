const fs = require('fs');
const yaml = require('yaml');

/**
 * Configuration loader for the application
 */
class ConfigLoader {
  constructor(configPath = 'config_template.yml') {
    this.configPath = configPath;
    this.config = null;
  }

  /**
   * Load configuration from YAML file
   * @returns {AppConfig} Application configuration
   */
  load() {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      const fileContent = fs.readFileSync(this.configPath, 'utf8');
      this.config = yaml.parse(fileContent);

      // Validate required fields
      this.validateConfig();

      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Validate configuration structure
   */
  validateConfig() {
    const requiredFields = ['sqlite_file', 'nginx_conf_dir', 'log_file', 'services'];

    for (const field of requiredFields) {
      if (!this.config[field]) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }

    // Set default nginx_refresh_cmd if not provided
    if (!this.config.nginx_refresh_cmd) {
      this.config.nginx_refresh_cmd = '/usr/sbin/nginx -s reload';
    }

    // Validate nginx_refresh_cmd if provided
    if (this.config.nginx_refresh_cmd && typeof this.config.nginx_refresh_cmd !== 'string') {
      throw new Error('nginx_refresh_cmd must be a string');
    }

    // Validate services
    if (
      typeof this.config.services !== 'object' ||
      Object.keys(this.config.services).length === 0
    ) {
      throw new Error('No services configured');
    }

    // Validate each service
    for (const [serviceName, service] of Object.entries(this.config.services)) {
      this.validateService(serviceName, service);
    }
  }

  /**
   * Validate individual service configuration
   * @param {string} serviceName - Name of the service
   * @param {ServiceConfig} service - Service configuration
   */
  validateService(serviceName, service) {
    const requiredFields = ['domain', 'check', 'interval', 'error_delay', 'if_failed'];

    for (const field of requiredFields) {
      if (!service[field]) {
        throw new Error(`Service '${serviceName}' missing required field: ${field}`);
      }
    }

    // Validate if_failed (if_success is now optional)
    if (!service.if_failed.host || !service.if_failed.port) {
      throw new Error(`Service '${serviceName}' if_failed missing host or port`);
    }

    // Validate if_failed scheme if provided
    if (service.if_failed.scheme && !['http', 'https'].includes(service.if_failed.scheme)) {
      throw new Error(`Service '${serviceName}' if_failed scheme must be 'http' or 'https'`);
    }

    // If if_success is provided, validate it
    if (service.if_success) {
      if (!service.if_success.host || !service.if_success.port) {
        throw new Error(`Service '${serviceName}' if_success missing host or port`);
      }

      // Validate if_success scheme if provided
      if (service.if_success.scheme && !['http', 'https'].includes(service.if_success.scheme)) {
        throw new Error(`Service '${serviceName}' if_success scheme must be 'http' or 'https'`);
      }
    }
  }

  /**
   * Get configuration
   * @returns {AppConfig} Application configuration
   */
  getConfig() {
    if (!this.config) {
      this.load();
    }
    return this.config;
  }

  /**
   * Reload configuration from file
   * @returns {AppConfig} Updated configuration
   */
  reload() {
    this.config = null;
    return this.load();
  }
}

module.exports = ConfigLoader;
