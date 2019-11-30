const { createWriteStream } = require('fs');
const { format } = require('util');

/**
 * @param {String} [filePath]
 * @param {String} [fmt]
 * @param {{}} [opts]
 * @returns {function(String, String, Object): function(String, String, String): Promise<void>}
 */
module.exports = (filePath = 'web-scraping-results.console', fmt = '%s %s %s\n', opts = {}) => {
  const stream = createWriteStream(filePath, opts);
  // eslint-disable-next-line require-await
  return async (url, sel, txt) => stream.write(format(fmt, url, sel, txt));
};
