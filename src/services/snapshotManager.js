const fs = require('fs').promises;
const path = require('path');

/**
 * Snapshot manager for handling service configuration snapshots
 */
class SnapshotManager {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.snapshotDir = config.snapshot_dir || './snapshots';
  }

  /**
   * Ensure snapshot directory exists
   */
  async ensureSnapshotDirectory() {
    try {
      await fs.mkdir(this.snapshotDir, { recursive: true });
      this.logger.debug(`Snapshot directory ensured: ${this.snapshotDir}`, 'snapshot-manager');
    } catch (error) {
      this.logger.error(
        `Failed to create snapshot directory: ${error.message}`,
        'snapshot-manager'
      );
      throw error;
    }
  }

  /**
   * Get the latest snapshot number
   * @returns {Promise<number>} Latest snapshot number or 0 if none exist
   */
  async getLatestSnapshotNumber() {
    try {
      await this.ensureSnapshotDirectory();
      const files = await fs.readdir(this.snapshotDir);
      const snapshotFiles = files.filter(
        file => file.startsWith('snapshot-') && file.endsWith('.json')
      );

      if (snapshotFiles.length === 0) {
        return 0;
      }

      const numbers = snapshotFiles
        .map(file => {
          const match = file.match(/snapshot-(\d+)\.json/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => !isNaN(num));

      return numbers.length > 0 ? Math.max(...numbers) : 0;
    } catch (error) {
      this.logger.error(
        `Failed to get latest snapshot number: ${error.message}`,
        'snapshot-manager'
      );
      return 0;
    }
  }

  /**
   * Create a new snapshot from current database state
   * @param {Object} services - Service configurations to snapshot
   * @param {string} description - Snapshot description
   * @returns {Promise<number>} Snapshot number
   */
  async createSnapshot(services, description = 'Initial snapshot') {
    try {
      await this.ensureSnapshotDirectory();

      const latestNumber = await this.getLatestSnapshotNumber();
      const snapshotNumber = latestNumber + 1;

      const snapshot = {
        id: snapshotNumber,
        timestamp: new Date().toISOString(),
        description,
        services: {},
      };

      // Create snapshot data for each service
      for (const [serviceName, serviceConfig] of Object.entries(services)) {
        snapshot.services[serviceName] = {
          host: serviceConfig.host,
          port: serviceConfig.port,
          scheme: serviceConfig.scheme,
          domain: serviceConfig.domain,
        };
      }

      const snapshotFile = path.join(this.snapshotDir, `snapshot-${snapshotNumber}.json`);
      await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));

      this.logger.info(
        `📸 Created snapshot ${snapshotNumber}: ${description}`,
        'snapshot-manager',
        { snapshotNumber, servicesCount: Object.keys(services).length }
      );

      return snapshotNumber;
    } catch (error) {
      this.logger.error(`Failed to create snapshot: ${error.message}`, 'snapshot-manager');
      throw error;
    }
  }

  /**
   * Load a specific snapshot
   * @param {number} snapshotNumber - Snapshot number to load
   * @returns {Promise<Object>} Snapshot data
   */
  async loadSnapshot(snapshotNumber) {
    try {
      const snapshotFile = path.join(this.snapshotDir, `snapshot-${snapshotNumber}.json`);
      const data = await fs.readFile(snapshotFile, 'utf8');
      const snapshot = JSON.parse(data);

      this.logger.info(
        `📸 Loaded snapshot ${snapshotNumber}: ${snapshot.description}`,
        'snapshot-manager',
        {
          snapshotNumber,
          timestamp: snapshot.timestamp,
          servicesCount: Object.keys(snapshot.services).length,
        }
      );

      return snapshot;
    } catch (error) {
      this.logger.error(
        `Failed to load snapshot ${snapshotNumber}: ${error.message}`,
        'snapshot-manager'
      );
      throw error;
    }
  }

  /**
   * Check if a snapshot exists
   * @param {number} snapshotNumber - Snapshot number to check
   * @returns {Promise<boolean>} Whether the snapshot exists
   */
  async snapshotExists(snapshotNumber) {
    try {
      const snapshotFile = path.join(this.snapshotDir, `snapshot-${snapshotNumber}.json`);
      await fs.access(snapshotFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all available snapshots
   * @returns {Promise<Array>} List of snapshot information
   */
  async listSnapshots() {
    try {
      await this.ensureSnapshotDirectory();
      const files = await fs.readdir(this.snapshotDir);
      const snapshotFiles = files.filter(
        file => file.startsWith('snapshot-') && file.endsWith('.json')
      );

      const snapshots = [];
      for (const file of snapshotFiles) {
        try {
          const snapshotFile = path.join(this.snapshotDir, file);
          const data = await fs.readFile(snapshotFile, 'utf8');
          const snapshot = JSON.parse(data);
          snapshots.push({
            id: snapshot.id,
            timestamp: snapshot.timestamp,
            description: snapshot.description,
            servicesCount: Object.keys(snapshot.services).length,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to read snapshot file ${file}: ${error.message}`,
            'snapshot-manager'
          );
        }
      }

      return snapshots.sort((a, b) => a.id - b.id);
    } catch (error) {
      this.logger.error(`Failed to list snapshots: ${error.message}`, 'snapshot-manager');
      return [];
    }
  }

  /**
   * Delete a specific snapshot
   * @param {number} snapshotNumber - Snapshot number to delete
   * @returns {Promise<boolean>} Whether the snapshot was deleted
   */
  async deleteSnapshot(snapshotNumber) {
    try {
      const snapshotFile = path.join(this.snapshotDir, `snapshot-${snapshotNumber}.json`);
      await fs.unlink(snapshotFile);

      this.logger.info(`🗑️ Deleted snapshot ${snapshotNumber}`, 'snapshot-manager');
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete snapshot ${snapshotNumber}: ${error.message}`,
        'snapshot-manager'
      );
      return false;
    }
  }

  /**
   * Get snapshot file path
   * @param {number} snapshotNumber - Snapshot number
   * @returns {string} Snapshot file path
   */
  getSnapshotPath(snapshotNumber) {
    return path.join(this.snapshotDir, `snapshot-${snapshotNumber}.json`);
  }
}

module.exports = SnapshotManager;
