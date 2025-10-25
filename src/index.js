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
    snapshot_number: null,
    force_snapshot: false,
    list_snapshots: false,
    create_snapshot: false,
    delete_snapshot: null,
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
      case '-s':
      case '--snapshot':
        if (i + 1 < args.length) {
          const snapshotNum = parseInt(args[i + 1], 10);
          if (isNaN(snapshotNum) || snapshotNum < 1) {
            console.error('Error: --snapshot requires a positive number');
            process.exit(1);
          }
          options.snapshot_number = snapshotNum;
          i++; // Skip next argument as it's the value
        } else {
          console.error('Error: --snapshot requires a snapshot number');
          process.exit(1);
        }
        break;
      case '-f':
      case '--force-snapshot':
        options.force_snapshot = true;
        break;
      case '-l':
      case '--list-snapshots':
        options.list_snapshots = true;
        break;
      case '--create-snapshot':
        options.create_snapshot = true;
        break;
      case '--delete-snapshot':
        if (i + 1 < args.length) {
          const snapshotNum = parseInt(args[i + 1], 10);
          if (isNaN(snapshotNum) || snapshotNum < 1) {
            console.error('Error: --delete-snapshot requires a positive number');
            process.exit(1);
          }
          options.delete_snapshot = snapshotNum;
          i++; // Skip next argument as it's the value
        } else {
          console.error('Error: --delete-snapshot requires a snapshot number');
          process.exit(1);
        }
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
  -c, --config <file>        Path to configuration file (default: config_template.yml)
  -s, --snapshot <number>    Use specific snapshot number
  -f, --force-snapshot       Force creation of new snapshot from current state
  -l, --list-snapshots      List all available snapshots
  --create-snapshot         Create a new snapshot from current state
  --delete-snapshot <num>   Delete a specific snapshot
  -h, --help                Display this help message
  -v, --version             Display version information

Examples:
  node src/index.js                                    # Use default config
  node src/index.js --config /path/to/config.yml      # Use custom config
  node src/index.js -c ./my-config.yml                # Use custom config (short form)
  node src/index.js --snapshot 3                      # Use snapshot number 3
  node src/index.js --force-snapshot                  # Force create new snapshot
  node src/index.js --list-snapshots                  # List all snapshots
  node src/index.js --create-snapshot                 # Create new snapshot
  node src/index.js --delete-snapshot 2               # Delete snapshot 2

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
 * Handle snapshot operations
 * @param {Object} options - Command line options
 */
async function handleSnapshotOperations(options) {
  const ConfigLoader = require('./config/configLoader');
  const SnapshotManager = require('./services/snapshotManager');
  const Logger = require('./utils/logger');

  try {
    // Load configuration
    const configLoader = new ConfigLoader(options.config);
    const config = configLoader.load();
    const logger = new Logger();
    const snapshotManager = new SnapshotManager(logger, config);

    if (options.list_snapshots) {
      console.log('📸 Available Snapshots:');
      console.log('');

      const snapshots = await snapshotManager.listSnapshots();
      if (snapshots.length === 0) {
        console.log('  No snapshots found.');
        return;
      }

      snapshots.forEach(snapshot => {
        console.log(`  📸 Snapshot ${snapshot.id}:`);
        console.log(`     Description: ${snapshot.description}`);
        console.log(`     Created: ${new Date(snapshot.timestamp).toLocaleString()}`);
        console.log(`     Services: ${snapshot.servicesCount}`);
        console.log('');
      });
    }

    if (options.create_snapshot) {
      console.log('📸 Creating snapshot from current database state...');

      // This would need to be implemented to read from database
      // For now, just show the message
      console.log('  Note: This feature requires database access to read current state.');
      console.log('  Use the application normally to create snapshots automatically.');
    }

    if (options.delete_snapshot !== null) {
      console.log(`🗑️ Deleting snapshot ${options.delete_snapshot}...`);

      const deleted = await snapshotManager.deleteSnapshot(options.delete_snapshot);
      if (deleted) {
        console.log(`✅ Snapshot ${options.delete_snapshot} deleted successfully.`);
      } else {
        console.log(`❌ Failed to delete snapshot ${options.delete_snapshot}.`);
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('❌ Snapshot operation failed:', error.message);
    process.exit(1);
  }
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
    this.snapshotOptions = {
      snapshot_number: null,
      force_snapshot: false
    };
  }

  /**
   * Set snapshot options from command line
   * @param {number} snapshotNumber - Snapshot number to use
   * @param {boolean} forceSnapshot - Force creation of new snapshot
   */
  setSnapshotOptions(snapshotNumber, forceSnapshot) {
    this.snapshotOptions = {
      snapshot_number: snapshotNumber,
      force_snapshot: forceSnapshot
    };
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Load configuration
      this.config = this.configLoader.load();

      // Apply snapshot options to config
      if (this.snapshotOptions.snapshot_number) {
        this.config.snapshot_number = this.snapshotOptions.snapshot_number;
      }
      if (this.snapshotOptions.force_snapshot) {
        this.config.force_snapshot = this.snapshotOptions.force_snapshot;
      }

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

      // Start service monitoring (now async)
      await this.serviceManager.start();

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

  // Handle snapshot operations
  if (options.list_snapshots || options.create_snapshot || options.delete_snapshot !== null) {
    handleSnapshotOperations(options);
    return;
  }

  // Create application with custom config path
  const app = new Application(options.config);

  // Pass snapshot options to application
  if (options.snapshot_number || options.force_snapshot) {
    app.setSnapshotOptions(options.snapshot_number, options.force_snapshot);
  }

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
