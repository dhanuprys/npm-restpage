const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Nginx configuration updater service
 */
class NginxConfigUpdater {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.nginxConfDir = config.nginx_conf_dir;
    this.nginxRefreshCmd = config.nginx_refresh_cmd || '/usr/sbin/nginx -s reload';
    this.nginxTestCmd = this.getNginxTestCommand();
  }

  /**
   * Get the nginx test command based on the refresh command
   * @returns {string} Nginx test command
   */
  getNginxTestCommand() {
    // Handle different command patterns
    const parts = this.nginxRefreshCmd.split(' ');

    // Find the nginx binary in the command
    let nginxIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes('nginx') && !parts[i].includes('-s')) {
        nginxIndex = i;
        break;
      }
    }

    if (nginxIndex === -1) {
      // Fallback: assume nginx is the first part
      return `${parts[0]} -t`;
    }

    // Replace the reload flag with test flag
    const testParts = [...parts];
    const reloadIndex = testParts.findIndex(part => part === '-s');
    if (reloadIndex !== -1 && testParts[reloadIndex + 1] === 'reload') {
      testParts[reloadIndex + 1] = 't';
    } else {
      // If no -s reload found, append -t
      testParts.push('-t');
    }

    return testParts.join(' ');
  }

  /**
   * Update Nginx configuration file for a proxy host
   * @param {number} proxyId - Proxy host ID
   * @param {string} oldHost - Current forward host
   * @param {string} newHost - New forward host
   * @param {number} oldPort - Current forward port
   * @param {number} newPort - New forward port
   * @returns {Promise<boolean>} Success status
   */
  async updateProxyConfig(proxyId, oldHost, newHost, oldPort, newPort) {
    const configPath = path.join(this.nginxConfDir, `${proxyId}.conf`);

    try {
      // Check if config file exists
      if (!fs.existsSync(configPath)) {
        this.logger.error(`Nginx config file not found: ${configPath}`, 'nginx', { proxyId });
        return false;
      }

      // Read current configuration
      const configContent = fs.readFileSync(configPath, 'utf8');

      // Create backup
      const backupPath = `${configPath}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, configContent);
      this.logger.debug(`Created backup: ${backupPath}`, 'nginx', { proxyId });

      // Update configuration
      const updatedContent = this.replaceUpstreamConfig(
        configContent,
        oldHost,
        newHost,
        oldPort,
        newPort
      );

      // Write updated configuration
      fs.writeFileSync(configPath, updatedContent);

      this.logger.configUpdate('nginx', oldHost, newHost, oldPort, newPort);
      this.logger.info(`Updated Nginx config: ${configPath}`, 'nginx', {
        proxyId,
        oldHost,
        newHost,
        oldPort,
        newPort,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to update Nginx config: ${error.message}`, 'nginx', {
        proxyId,
        configPath,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Replace upstream configuration in Nginx config content
   *
   * Supports Nginx Proxy Manager format:
   * - set $server "192.168.11.2";
   * - set $port 8010;
   *
   * Also supports traditional upstream format as fallback:
   * - server 192.168.11.1:8000;
   *
   * @param {string} content - Original config content
   * @param {string} oldHost - Current host
   * @param {string} newHost - New host
   * @param {number} oldPort - Current port
   * @param {number} newPort - New port
   * @returns {string} Updated config content
   */
  replaceUpstreamConfig(content, oldHost, newHost, oldPort, newPort) {
    let updatedContent = content;

    // Handle Nginx Proxy Manager format: set $server "192.168.11.2";
    const serverSetPattern = new RegExp(
      `(set\\s+\\$server\\s*")${oldHost.replace(/\./g, '\\.')}("\\s*;)`,
      'g'
    );
    updatedContent = updatedContent.replace(serverSetPattern, `$1${newHost}$2`);

    // Handle Nginx Proxy Manager format: set $port 8010;
    const portSetPattern = new RegExp(`(set\\s+\\$port\\s*)${oldPort}(\\s*;)`, 'g');
    updatedContent = updatedContent.replace(portSetPattern, `$1${newPort}$2`);

    // Also handle traditional upstream server format as fallback
    // Matches: server 192.168.11.1:8000;
    const serverPattern = new RegExp(`server\\s+${oldHost.replace(/\./g, '\\.')}:${oldPort};`, 'g');
    updatedContent = updatedContent.replace(serverPattern, `server ${newHost}:${newPort};`);

    // Handle cases where host and port might be on separate lines
    const hostPattern = new RegExp(`server\\s+${oldHost.replace(/\./g, '\\.')}:${oldPort}`, 'g');
    updatedContent = updatedContent.replace(hostPattern, `server ${newHost}:${newPort}`);

    return updatedContent;
  }

  /**
   * Reload Nginx configuration
   * @returns {Promise<boolean>} Success status
   */
  async reloadNginx() {
    return new Promise(resolve => {
      this.logger.info(`Reloading Nginx configuration using: ${this.nginxRefreshCmd}`, 'nginx');

      exec(this.nginxRefreshCmd, (error, stdout, stderr) => {
        if (error) {
          this.logger.nginxReload(false, error.message);
          this.logger.error(`Nginx reload failed: ${error.message}`, 'nginx', {
            command: this.nginxRefreshCmd,
            stderr: stderr.toString(),
          });
          resolve(false);
        } else {
          this.logger.nginxReload(true);
          this.logger.info('Nginx reloaded successfully', 'nginx');
          resolve(true);
        }
      });
    });
  }

  /**
   * Test Nginx configuration syntax
   * @returns {Promise<boolean>} Configuration validity
   */
  async testNginxConfig() {
    return new Promise(resolve => {
      this.logger.debug(`Testing Nginx configuration syntax using: ${this.nginxTestCmd}`, 'nginx');

      exec(this.nginxTestCmd, (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`Nginx config test failed: ${error.message}`, 'nginx', {
            command: this.nginxTestCmd,
            stderr: stderr.toString(),
          });
          resolve(false);
        } else {
          this.logger.debug('Nginx configuration test passed', 'nginx');
          resolve(true);
        }
      });
    });
  }

  /**
   * Get Nginx status
   * @returns {Promise<Object>} Nginx status information
   */
  async getNginxStatus() {
    return new Promise(resolve => {
      exec('systemctl is-active nginx', (error, stdout) => {
        const isActive = !error && stdout.trim() === 'active';

        resolve({
          active: isActive,
          status: isActive ? 'running' : 'stopped',
          error: error ? error.message : null,
        });
      });
    });
  }

  /**
   * Ensure Nginx configuration directory exists
   * @returns {boolean} Success status
   */
  ensureConfigDirectory() {
    try {
      if (!fs.existsSync(this.nginxConfDir)) {
        fs.mkdirSync(this.nginxConfDir, { recursive: true });
        this.logger.info(`Created Nginx config directory: ${this.nginxConfDir}`, 'nginx');
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to create config directory: ${error.message}`, 'nginx');
      return false;
    }
  }
}

module.exports = NginxConfigUpdater;
