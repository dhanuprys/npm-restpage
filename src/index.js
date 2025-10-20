#!/usr/bin/env node

const ConfigLoader = require('./config/configLoader');
const Logger = require('./utils/logger');
const ServiceManager = require('./services/serviceManager');

/**
 * Main application entry point
 */
class Application {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.config = null;
    this.logger = null;
    this.serviceManager = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Load configuration
      this.config = this.configLoader.load();
      
      // Initialize logger
      this.logger = new Logger(this.config);
      
      this.logger.info('Starting Nginx Proxy Manager Switcher...', 'app');
      this.logger.info(`Configuration loaded from: ${this.configLoader.configPath}`, 'app');
      
      // Initialize service manager
      this.serviceManager = new ServiceManager(this.config, this.logger);
      await this.serviceManager.initialize();
      
      this.logger.success('Application initialized successfully', 'app');
      
    } catch (error) {
      console.error('Failed to initialize application:', error.message);
      process.exit(1);
    }
  }

  /**
   * Start the application
   */
  async start() {
    try {
      await this.initialize();
      
      // Start service monitoring
      this.serviceManager.start();
      
      this.logger.success('Application started successfully', 'app');
      
      // Set up graceful shutdown
      this.setupGracefulShutdown();
      
      // Log service status periodically
      this.setupStatusLogging();
      
    } catch (error) {
      this.logger.error(`Failed to start application: ${error.message}`, 'app');
      process.exit(1);
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`, 'app');
      
      try {
        if (this.serviceManager) {
          await this.serviceManager.shutdown();
        }
        
        this.logger.success('Application shutdown complete', 'app');
        process.exit(0);
        
      } catch (error) {
        this.logger.error(`Error during shutdown: ${error.message}`, 'app');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  }

  /**
   * Set up periodic status logging
   */
  setupStatusLogging() {
    // Log status every 5 minutes
    setInterval(() => {
      const status = this.serviceManager.getServiceStatus();
      this.logger.info('Service Status Report:', 'app', status);
    }, 5 * 60 * 1000);
  }

  /**
   * Get application status
   */
  getStatus() {
    if (!this.serviceManager) {
      return { status: 'not_initialized' };
    }
    
    return {
      status: 'running',
      ...this.serviceManager.getServiceStatus()
    };
  }
}

// Main execution
if (require.main === module) {
  const app = new Application();
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
  
  // Start the application
  app.start().catch((error) => {
    console.error('Application failed to start:', error);
    process.exit(1);
  });
}

module.exports = Application;
