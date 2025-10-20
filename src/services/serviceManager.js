const HealthChecker = require('./healthChecker');
const NginxConfigUpdater = require('./nginxConfigUpdater');
const DatabaseManager = require('../database/databaseManager');

/**
 * Main service manager for handling service monitoring and switching
 */
class ServiceManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.healthChecker = new HealthChecker(logger);
    this.nginxUpdater = new NginxConfigUpdater(config, logger);
    this.database = new DatabaseManager(config, logger);

    this.serviceStates = new Map(); // Track service states
    this.timers = new Map(); // Track interval timers
    this.isRunning = false;
  }

  /**
   * Initialize the service manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing Service Manager...', 'service-manager');

      // Connect to database
      await this.database.connect();

      // Ensure Nginx config directory exists
      this.nginxUpdater.ensureConfigDirectory();

      // Test Nginx configuration
      const nginxConfigValid = await this.nginxUpdater.testNginxConfig();
      if (!nginxConfigValid) {
        throw new Error('Nginx configuration is invalid');
      }

      // Initialize service states
      this.initializeServiceStates();

      this.logger.success('Service Manager initialized successfully', 'service-manager');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Service Manager: ${error.message}`,
        'service-manager'
      );
      throw error;
    }
  }

  /**
   * Initialize service states from configuration
   */
  initializeServiceStates() {
    for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
      this.serviceStates.set(serviceName, {
        name: serviceName,
        config: serviceConfig,
        isHealthy: false,
        lastCheck: null,
        consecutiveFailures: 0,
        currentHost: null,
        currentPort: null,
      });

      this.logger.debug(`Initialized service state: ${serviceName}`, 'service-manager');
    }
  }

  /**
   * Start monitoring all services
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Service Manager is already running', 'service-manager');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting service monitoring...', 'service-manager');

    // Start monitoring each service
    for (const [serviceName, serviceState] of this.serviceStates) {
      this.startServiceMonitoring(serviceName, serviceState);
    }
  }

  /**
   * Stop monitoring all services
   */
  stop() {
    if (!this.isRunning) {
      this.logger.warn('Service Manager is not running', 'service-manager');
      return;
    }

    this.isRunning = false;
    this.logger.info('Stopping service monitoring...', 'service-manager');

    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    this.logger.success('Service monitoring stopped', 'service-manager');
  }

  /**
   * Start monitoring a specific service
   * @param {string} serviceName - Name of the service
   * @param {Object} serviceState - Service state object
   */
  startServiceMonitoring(serviceName, serviceState) {
    const checkService = async () => {
      if (!this.isRunning) return;

      try {
        await this.checkAndUpdateService(serviceName, serviceState);
      } catch (error) {
        this.logger.error(
          `Error checking service ${serviceName}: ${error.message}`,
          'service-manager'
        );
      }

      // Schedule next check
      this.scheduleNextCheck(serviceName, serviceState);
    };

    // Start first check immediately
    checkService();
  }

  /**
   * Schedule next health check for a service
   * @param {string} serviceName - Name of the service
   * @param {Object} serviceState - Service state object
   */
  scheduleNextCheck(serviceName, serviceState) {
    if (!this.isRunning) return;

    const { config } = serviceState;
    const interval = serviceState.isHealthy
      ? this.healthChecker.parseTimeToMs(config.interval)
      : this.healthChecker.parseTimeToMs(config.error_delay);

    const timer = setTimeout(() => {
      this.startServiceMonitoring(serviceName, serviceState);
    }, interval);

    this.timers.set(serviceName, timer);

    this.logger.debug(
      `Scheduled next check for ${serviceName} in ${interval}ms`,
      'service-manager'
    );
  }

  /**
   * Check and update a service
   * @param {string} serviceName - Name of the service
   * @param {Object} serviceState - Service state object
   */
  async checkAndUpdateService(serviceName, serviceState) {
    const { config } = serviceState;

    // Perform health check
    const healthResult = await this.healthChecker.checkHealth(config.check, serviceName);

    // Update service state
    serviceState.isHealthy = healthResult.success;
    serviceState.lastCheck = new Date();

    if (healthResult.success) {
      serviceState.consecutiveFailures = 0;
    } else {
      serviceState.consecutiveFailures++;
    }

    // Determine target configuration
    const targetConfig = healthResult.success ? config.if_success : config.if_failed;

    // Check if we need to update the proxy configuration
    const needsUpdate = this.needsConfigurationUpdate(serviceState, targetConfig);

    if (needsUpdate) {
      await this.updateServiceConfiguration(serviceName, serviceState, targetConfig);
    }
  }

  /**
   * Check if service configuration needs to be updated
   * @param {Object} serviceState - Current service state
   * @param {Object} targetConfig - Target configuration
   * @returns {boolean} Whether update is needed
   */
  needsConfigurationUpdate(serviceState, targetConfig) {
    return (
      serviceState.currentHost !== targetConfig.host ||
      serviceState.currentPort !== targetConfig.port
    );
  }

  /**
   * Update service configuration
   * @param {string} serviceName - Name of the service
   * @param {Object} serviceState - Service state object
   * @param {Object} targetConfig - Target configuration
   */
  async updateServiceConfiguration(serviceName, serviceState, targetConfig) {
    try {
      // Find proxy host in database
      const proxyHost = await this.database.findProxyHostByDomain(serviceState.config.domain);

      if (!proxyHost) {
        this.logger.error(
          `No proxy host found for domain: ${serviceState.config.domain}`,
          serviceName
        );
        return;
      }

      const oldHost = serviceState.currentHost || proxyHost.forward_host;
      const oldPort = serviceState.currentPort || proxyHost.forward_port;
      const newHost = targetConfig.host;
      const newPort = targetConfig.port;

      this.logger.info(
        `Updating configuration for ${serviceName}: ${oldHost}:${oldPort} → ${newHost}:${newPort}`,
        serviceName
      );

      // Update Nginx configuration
      const nginxUpdateSuccess = await this.nginxUpdater.updateProxyConfig(
        proxyHost.id,
        oldHost,
        newHost,
        oldPort,
        newPort
      );

      if (!nginxUpdateSuccess) {
        this.logger.error(`Failed to update Nginx configuration for ${serviceName}`, serviceName);
        return;
      }

      // Update database
      const dbUpdateSuccess = await this.database.updateProxyHost(proxyHost.id, newHost, newPort);

      if (!dbUpdateSuccess) {
        this.logger.error(`Failed to update database for ${serviceName}`, serviceName);
        return;
      }

      // Update service state
      serviceState.currentHost = newHost;
      serviceState.currentPort = newPort;

      // Reload Nginx
      const nginxReloadSuccess = await this.nginxUpdater.reloadNginx();

      if (nginxReloadSuccess) {
        this.logger.success(`Successfully updated ${serviceName} configuration`, serviceName);
      } else {
        this.logger.error(
          `Configuration updated but Nginx reload failed for ${serviceName}`,
          serviceName
        );
      }
    } catch (error) {
      this.logger.error(`Failed to update service configuration: ${error.message}`, serviceName);
    }
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getServiceStatus() {
    const status = {
      isRunning: this.isRunning,
      services: {},
    };

    for (const [serviceName, serviceState] of this.serviceStates) {
      status.services[serviceName] = {
        name: serviceName,
        isHealthy: serviceState.isHealthy,
        lastCheck: serviceState.lastCheck,
        consecutiveFailures: serviceState.consecutiveFailures,
        currentHost: serviceState.currentHost,
        currentPort: serviceState.currentPort,
        checkUrl: serviceState.config.check,
      };
    }

    return status;
  }

  /**
   * Shutdown the service manager
   */
  async shutdown() {
    this.logger.info('Shutting down Service Manager...', 'service-manager');

    this.stop();
    await this.database.close();

    this.logger.success('Service Manager shutdown complete', 'service-manager');
  }
}

module.exports = ServiceManager;
