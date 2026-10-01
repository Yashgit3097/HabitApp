const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to project-relative .cache directory
  // This ensures Chrome is saved in the persistent application directory on Render
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
