const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Database manager for SQLite operations
 */
class DatabaseManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const dbPath = this.config.sqlite_file;

      // Ensure directory exists
      const dbDir = path.dirname(dbPath);
      require('fs').mkdirSync(dbDir, { recursive: true });

      // Ensure backup directory exists
      this.ensureBackupDirectory();

      this.db = new sqlite3.Database(dbPath, err => {
        if (err) {
          this.logger.error(`Failed to connect to database: ${err.message}`, 'database');
          reject(err);
        } else {
          this.logger.info(`Connected to database: ${dbPath}`, 'database');
          resolve();
        }
      });
    });
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise(resolve => {
      if (this.db) {
        this.db.close(err => {
          if (err) {
            this.logger.error(`Error closing database: ${err.message}`, 'database');
          } else {
            this.logger.info('Database connection closed', 'database');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDirectory() {
    const backupDir = this.config.backup_dir || './backups';

    if (!fs.existsSync(backupDir)) {
      try {
        fs.mkdirSync(backupDir, { recursive: true });
        this.logger.info(`Created backup directory: ${backupDir}`, 'database');
      } catch (error) {
        this.logger.error(`Failed to create backup directory: ${error.message}`, 'database', {
          backupDir,
        });
      }
    }
  }

  /**
   * Backup initial proxy_host data
   * @param {string} serviceName - Name of the service being initialized
   * @param {Object} proxyHost - Proxy host data to backup
   */
  async backupInitialProxyHost(serviceName, proxyHost) {
    try {
      const backupDir = this.config.backup_dir || './backups';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `proxy_host_${serviceName}_${timestamp}.json`;
      const filepath = path.join(backupDir, filename);

      const backupData = {
        timestamp: new Date().toISOString(),
        serviceName,
        proxyHost: {
          id: proxyHost.id,
          domain_names: proxyHost.domain_names,
          forward_host: proxyHost.forward_host,
          forward_port: proxyHost.forward_port,
          forward_scheme: proxyHost.forward_scheme,
          enabled: proxyHost.enabled,
        },
        metadata: {
          backupType: 'initial',
          description: 'Initial proxy_host configuration before any modifications',
        },
      };

      fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
      this.logger.info(`Backed up initial proxy_host for ${serviceName}: ${filename}`, 'database', {
        serviceName,
        filename,
        proxyHostId: proxyHost.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to backup initial proxy_host for ${serviceName}: ${error.message}`,
        'database',
        {
          serviceName,
          proxyHostId: proxyHost.id,
        }
      );
    }
  }

  /**
   * Find proxy host by domain name
   * @param {string} domain - Domain name to search for
   * @returns {Promise<ProxyHost|null>} Proxy host record or null if not found
   */
  async findProxyHostByDomain(domain) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, domain_names, forward_host, forward_port, forward_scheme, enabled
        FROM proxy_host
        WHERE domain_names LIKE ? AND is_deleted = 0
      `;

      // Format domain as JSON array pattern: ["domain.com"]
      const domainPattern = `%["${domain}"]%`;

      this.db.get(query, [domainPattern], (err, row) => {
        if (err) {
          this.logger.error(`Database query failed: ${err.message}`, 'database', { domain });
          reject(err);
        } else if (!row) {
          this.logger.warn(`No proxy host found for domain: ${domain}`, 'database');
          resolve(null);
        } else {
          this.logger.debug(`Found proxy host for domain: ${domain}`, 'database', {
            id: row.id,
            forward_host: row.forward_host,
            forward_port: row.forward_port,
            forward_scheme: row.forward_scheme,
          });
          resolve(row);
        }
      });
    });
  }

  /**
   * Update proxy host forward settings
   * @param {number} id - Proxy host ID
   * @param {string} newHost - New forward host
   * @param {number} newPort - New forward port
   * @param {string} [newScheme] - New forward scheme (optional)
   * @returns {Promise<boolean>} Success status
   */
  async updateProxyHost(id, newHost, newPort, newScheme = null) {
    return new Promise((resolve, reject) => {
      let query, params;

      if (newScheme) {
        query = `
          UPDATE proxy_host
          SET forward_host = ?, forward_port = ?, forward_scheme = ?, modified_on = datetime('now')
          WHERE id = ?
        `;
        params = [newHost, newPort, newScheme, id];
      } else {
        query = `
          UPDATE proxy_host
          SET forward_host = ?, forward_port = ?, modified_on = datetime('now')
          WHERE id = ?
        `;
        params = [newHost, newPort, id];
      }

      this.db.run(query, params, err => {
        if (err) {
          this.logger.error(`Failed to update proxy host: ${err.message}`, 'database', {
            id,
            newHost,
            newPort,
            newScheme,
          });
          reject(err);
        } else if (this.changes === 0) {
          this.logger.warn(`No rows updated for proxy host ID: ${id}`, 'database');
          resolve(false);
        } else {
          const schemeInfo = newScheme ? ` (scheme: ${newScheme})` : '';
          this.logger.info(
            `Updated proxy host ID ${id}: ${newHost}:${newPort}${schemeInfo}`,
            'database'
          );
          resolve(true);
        }
      });
    });
  }

  /**
   * Get all enabled proxy hosts
   * @returns {Promise<Array<ProxyHost>>} Array of enabled proxy hosts
   */
  async getAllEnabledProxyHosts() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, domain_names, forward_host, forward_port, forward_scheme
        FROM proxy_host
        WHERE enabled = 1 AND is_deleted = 0
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          this.logger.error(`Failed to get proxy hosts: ${err.message}`, 'database');
          reject(err);
        } else {
          this.logger.debug(`Retrieved ${rows.length} enabled proxy hosts`, 'database');
          resolve(rows);
        }
      });
    });
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    return new Promise(resolve => {
      if (!this.db) {
        resolve(false);
        return;
      }

      this.db.get('SELECT 1 as test', [], err => {
        if (err) {
          this.logger.error(`Database connection test failed: ${err.message}`, 'database');
          resolve(false);
        } else {
          this.logger.debug('Database connection test successful', 'database');
          resolve(true);
        }
      });
    });
  }
}

module.exports = DatabaseManager;
