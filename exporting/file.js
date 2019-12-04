const fs = require('fs');

const consoleExport = require('./console');

/**
 * @param {string} uri
 * @param {string} selector
 * @param {string} text
 * @returns {string}
 */
const csvFmt = (uri, selector, text) => `"${uri.replace(/"/g, "'")}","${selector.replace(/"/g, "'")}","${text.replace(/"/g, "'")}"\n`;

/**
 * @param {string} [filePath]
 * @param {String|function(String, String, String): String} [fmt]
 * @param {*} [opts]
 * @returns {function(String, String, String): Promise<void>}
 */
module.exports = (filePath, fmt = csvFmt, opts = {}) => {
  const p = filePath || (`results-${new Date().toISOString().replace(/\W+/g, '-')}.csv`);
  const file = fs.createWriteStream(p);
  return consoleExport(fmt, (msg) => file.write(msg));
};
