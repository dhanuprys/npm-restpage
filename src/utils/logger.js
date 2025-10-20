const winston = require('winston');
const chalk = require('chalk');

/**
 * Colorful logger utility for the application
 */
class Logger {
  constructor(config) {
    this.config = config;
    this.logger = this.createLogger();
  }

  /**
   * Create Winston logger instance
   * @returns {winston.Logger} Configured logger
   */
  createLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const serviceTag = service ? `[${service}]` : '';
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} ${this.colorizeLevel(level)} ${serviceTag} ${message} ${metaStr}`;
      })
    );

    const transports = [
      new winston.transports.Console({
        format: logFormat,
        level: 'debug',
      }),
    ];

    // Add file transport if log file is configured
    if (this.config && this.config.log_file) {
      transports.push(
        new winston.transports.File({
          filename: this.config.log_file,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
          level: 'info',
        })
      );
    }

    return winston.createLogger({
      level: 'debug',
      format: logFormat,
      transports,
    });
  }

  /**
   * Colorize log level
   * @param {string} level - Log level
   * @returns {string} Colorized log level
   */
  colorizeLevel(level) {
    const colors = {
      error: chalk.red.bold,
      warn: chalk.yellow.bold,
      info: chalk.blue.bold,
      debug: chalk.gray.bold,
      success: chalk.green.bold,
    };

    const colorFn = colors[level] || chalk.white;
    return colorFn(`[${level.toUpperCase()}]`);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {string} service - Service name (optional)
   * @param {Object} meta - Additional metadata
   */
  info(message, service = null, meta = {}) {
    this.logger.info(message, { service, ...meta });
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {string} service - Service name (optional)
   * @param {Object} meta - Additional metadata
   */
  error(message, service = null, meta = {}) {
    this.logger.error(message, { service, ...meta });
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {string} service - Service name (optional)
   * @param {Object} meta - Additional metadata
   */
  warn(message, service = null, meta = {}) {
    this.logger.warn(message, { service, ...meta });
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {string} service - Service name (optional)
   * @param {Object} meta - Additional metadata
   */
  debug(message, service = null, meta = {}) {
    this.logger.debug(message, { service, ...meta });
  }

  /**
   * Log success message
   * @param {string} message - Log message
   * @param {string} service - Service name (optional)
   * @param {Object} meta - Additional metadata
   */
  success(message, service = null, meta = {}) {
    this.logger.info(message, { service, level: 'success', ...meta });
  }

  /**
   * Log health check result
   * @param {string} service - Service name
   * @param {boolean} success - Whether check succeeded
   * @param {number} responseTime - Response time in ms
   * @param {string} error - Error message if failed
   */
  healthCheck(service, success, responseTime = null, error = null) {
    const message = success
      ? `Health check passed (${responseTime}ms)`
      : `Health check failed: ${error}`;

    const meta = { responseTime, error };

    if (success) {
      this.success(message, service, meta);
    } else {
      this.error(message, service, meta);
    }
  }

  /**
   * Log configuration update
   * @param {string} service - Service name
   * @param {string} oldHost - Previous host
   * @param {string} newHost - New host
   * @param {number} oldPort - Previous port
   * @param {number} newPort - New port
   */
  configUpdate(service, oldHost, newHost, oldPort, newPort) {
    const message = `Configuration updated: ${oldHost}:${oldPort} → ${newHost}:${newPort}`;
    this.success(message, service, { oldHost, newHost, oldPort, newPort });
  }

  /**
   * Log nginx reload
   * @param {boolean} success - Whether reload succeeded
   * @param {string} error - Error message if failed
   */
  nginxReload(success, error = null) {
    const message = success
      ? 'Nginx configuration reloaded successfully'
      : `Nginx reload failed: ${error}`;

    if (success) {
      this.success(message, 'nginx');
    } else {
      this.error(message, 'nginx', { error });
    }
  }
}

module.exports = Logger;
