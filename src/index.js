#!/usr/bin/env node

const ConfigLoader = require('./config/configLoader');
const Logger = require('./utils/logger');
const ServiceManager = require('./services/serviceManager');

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    config: 'config_template.yml', // Default config file
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-c':
      case '--config':
        if (i + 1 < args.length) {
          options.config = args[i + 1];
          i++; // Skip next argument as it's the config file path
        } else {
          console.error('Error: --config requires a file path');
          process.exit(1);
        }
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option ${arg}`);
          console.error('Use --help for usage information');
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
Nginx Proxy Manager Switcher

Usage: node src/index.js [options]

Options:
  -c, --config <file>    Path to configuration file (default: config_template.yml)
  -h, --help            Display this help message
  -v, --version         Display version information

Examples:
  node src/index.js                                    # Use default config
  node src/index.js --config /path/to/config.yml      # Use custom config
  node src/index.js -c ./my-config.yml                # Use custom config (short form)

Configuration File:
  The configuration file should be a YAML file containing:
  - Global settings (sqlite_file, nginx_conf_dir, log_file)
  - Service definitions with health check URLs and upstream servers

For more information, see the README.md file.
`);
}

/**
 * Display version information
 */
function displayVersion() {
  const packageJson = require('../package.json');
  console.log(`${packageJson.name} v${packageJson.version}`);
  console.log(packageJson.description);
}

/**
 * Main application entry point
 */
class Application {
  constructor(configPath = 'config_template.yml') {
    this.configLoader = new ConfigLoader(configPath);
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
  // Parse command line arguments
  const options = parseArguments();

  // Handle help and version flags
  if (options.help) {
    displayHelp();
    process.exit(0);
  }

  if (options.version) {
    displayVersion();
    process.exit(0);
  }

  // Create application with custom config path
  const app = new Application(options.config);

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
