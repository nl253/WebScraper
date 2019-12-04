const { createWriteStream } = require('fs');

const consoleExport = require('./console');

/**
 * @param {string} uri
 * @param {string} selector
 * @param {string} text
 * @returns {string}
 * @private
 */
const csvFmt = (uri, selector, text) => `"${uri.replace(/"/g, "'")}","${selector.replace(/"/g, "'")}","${text.replace(/"/g, "'")}"\n`;

/**
 * @param {string} [filePath]
 * @param {string|function(string, string, string): string} [fmt]
 * @param {Partial<{flags: string, encoding: string, fd: number, mode: number, autoClose: boolean, start: number}>} [opts]
 * @returns {ExportFunct}
 */
const fileExport = (filePath, fmt = csvFmt, opts = {}) => {
  const p = filePath || (`results-${new Date().toISOString().replace(/\W+/g, '-')}.csv`);
  const file = createWriteStream(p, opts);
  return consoleExport(fmt, (msg) => file.write(msg));
};

module.exports = fileExport;
