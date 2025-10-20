/**
 * Type definitions for the Nginx Proxy Manager Switcher
 */

/**
 * Service configuration from YAML config
 * @typedef {Object} ServiceConfig
 * @property {string} domain - Domain name for the service
 * @property {string} check - Health check URL
 * @property {string} interval - Time between health checks when service is UP
 * @property {string} error_delay - Time to wait before retrying after failure
 * @property {Object} [if_success] - Upstream server config when health check succeeds (optional, uses original config from database if not provided)
 * @property {string} [if_success.host] - Host when successful
 * @property {number} [if_success.port] - Port when successful
 * @property {Object} if_failed - Fallback upstream server config when health check fails
 * @property {string} if_failed.host - Host when failed
 * @property {number} if_failed.port - Port when failed
 */

/**
 * Application configuration
 * @typedef {Object} AppConfig
 * @property {string} sqlite_file - Path to SQLite database file
 * @property {string} nginx_conf_dir - Directory for Nginx proxy configurations
 * @property {string} log_file - Path to log file
 * @property {string} [nginx_refresh_cmd] - Command to reload Nginx configuration (optional, defaults to '/usr/sbin/nginx -s reload')
 * @property {Object.<string, ServiceConfig>} services - Service configurations
 */

/**
 * Database proxy host record
 * @typedef {Object} ProxyHost
 * @property {number} id - Unique identifier
 * @property {string} domain_names - JSON string of domain names
 * @property {string} forward_host - Current forward host
 * @property {number} forward_port - Current forward port
 * @property {string} forward_scheme - Forward scheme (http/https)
 * @property {number} enabled - Whether the proxy is enabled
 */

/**
 * Health check result
 * @typedef {Object} HealthCheckResult
 * @property {boolean} success - Whether the health check passed
 * @property {number} responseTime - Response time in milliseconds
 * @property {string} error - Error message if failed
 */

module.exports = {};
