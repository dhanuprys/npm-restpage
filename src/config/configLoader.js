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
    const requiredFields = [
      'domain',
      'check',
      'interval',
      'error_delay',
      'if_success',
      'if_failed',
    ];

    for (const field of requiredFields) {
      if (!service[field]) {
        throw new Error(`Service '${serviceName}' missing required field: ${field}`);
      }
    }

    // Validate if_success and if_failed
    ['if_success', 'if_failed'].forEach(condition => {
      if (!service[condition].host || !service[condition].port) {
        throw new Error(`Service '${serviceName}' ${condition} missing host or port`);
      }
    });
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
