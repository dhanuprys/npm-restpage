const axios = require('axios');
const http = require('http');
const https = require('https');

/**
 * Health checker service for monitoring service availability
 */
class HealthChecker {
  constructor(logger) {
    this.logger = logger;

    // Configure HTTP and HTTPS agents with proper keep-alive settings
    const httpAgent = new http.Agent({
      keepAlive: false, // Disable keep-alive to prevent socket hang-ups
      maxSockets: 50,
      timeout: 10000,
    });

    const httpsAgent = new https.Agent({
      keepAlive: false, // Disable keep-alive to prevent socket hang-ups
      maxSockets: 50,
      timeout: 10000,
      rejectUnauthorized: false, // Allow self-signed certificates
    });

    this.axiosInstance = axios.create({
      timeout: 10000, // 10 second timeout
      maxRedirects: 5,
      validateStatus: status => status >= 200 && status < 300, // Only 2xx is success
      headers: {
        'User-Agent': 'Nginx-Proxy-Manager-Switcher/1.0.0',
        Connection: 'close', // Explicitly close connection after request
      },
      httpAgent,
      httpsAgent,
    });
  }

  /**
   * Perform health check on a service
   * @param {string} checkUrl - URL to check
   * @param {string} serviceName - Name of the service being checked
   * @param {number} retries - Number of retry attempts (defaults to 3)
   * @returns {Promise<HealthCheckResult>} Health check result
   */
  async checkHealth(checkUrl, serviceName, retries = 3) {
    const maxRetries = Math.max(1, retries); // Ensure at least 1 attempt
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        if (attempt > 1) {
          this.logger.debug(
            `Health check retry ${attempt}/${maxRetries}: ${checkUrl}`,
            serviceName
          );
        } else {
          this.logger.debug(`Starting health check: ${checkUrl}`, serviceName);
        }

        const response = await this.axiosInstance.get(checkUrl);
        const responseTime = Date.now() - startTime;

        // Consider 2xx status codes as success
        const success = response.status >= 200 && response.status < 300;

        if (success) {
          if (attempt > 1) {
            this.logger.info(
              `Health check succeeded on retry ${attempt}/${maxRetries}`,
              serviceName,
              { responseTime, attempt }
            );
          }
          this.logger.healthCheck(serviceName, true, responseTime);

          return {
            success,
            responseTime,
            error: null,
            attempts: attempt,
          };
        } else {
          lastError = `HTTP ${response.status}`;
          if (attempt < maxRetries) {
            this.logger.warn(
              `Health check failed (attempt ${attempt}/${maxRetries}): HTTP ${response.status}`,
              serviceName,
              { responseTime, attempt }
            );
            // Wait a bit before retrying
            await this.sleep(1000);
            continue;
          }
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        let errorMessage = 'Unknown error';

        if (error.code === 'ECONNREFUSED') {
          errorMessage = 'Connection refused';
        } else if (error.code === 'ETIMEDOUT') {
          errorMessage = 'Connection timeout';
        } else if (error.code === 'ENOTFOUND') {
          errorMessage = 'Host not found';
        } else if (error.response) {
          errorMessage = `HTTP ${error.response.status}`;
        } else if (error.message) {
          errorMessage = error.message;
        }

        lastError = errorMessage;

        if (attempt < maxRetries) {
          this.logger.warn(
            `Health check failed (attempt ${attempt}/${maxRetries}): ${errorMessage}`,
            serviceName,
            { responseTime, attempt }
          );
          // Wait a bit before retrying
          await this.sleep(1000);
          continue;
        }

        // Last attempt failed
        this.logger.healthCheck(serviceName, false, responseTime, errorMessage);

        return {
          success: false,
          responseTime,
          error: errorMessage,
          attempts: attempt,
        };
      }
    }

    // All retries exhausted
    this.logger.healthCheck(serviceName, false, null, lastError);
    return {
      success: false,
      responseTime: 0,
      error: lastError,
      attempts: maxRetries,
    };
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse time string to milliseconds
   * @param {string} timeStr - Time string (e.g., "2s", "5m", "1h")
   * @returns {number} Milliseconds
   */
  parseTimeToMs(timeStr) {
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }

  /**
   * Validate health check URL
   * @param {string} url - URL to validate
   * @returns {boolean} Whether URL is valid
   */
  isValidUrl(url) {
    try {
      // eslint-disable-next-line no-undef
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get health check statistics
   * @param {string} serviceName - Service name
   * @returns {Object} Statistics object
   */
  getStats(serviceName) {
    // This could be extended to track statistics over time
    return {
      service: serviceName,
      lastCheck: new Date().toISOString(),
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
    };
  }
}

module.exports = HealthChecker;
