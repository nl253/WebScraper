const { format } = require('util');

/**
 * @param {String|function(String, String, String): String} [fmt]
 * @param {function(String): void} [consumer]
 * @returns {function(String, String, String): Promise<void>}
 */
const consoleExport = (fmt = (uri, selector, text) => `MATCH ${uri} ${text.slice(0, 150)}`, consumer = console.log) => {
  if (fmt.constructor.name[0] === 'S') {
    return consoleExport((uri, selector, text) => format(fmt, uri, selector, text), consumer);
  } else {
    // eslint-disable-next-line require-await
    return async (uri, selector, text) => consumer(fmt(uri, selector, text));
  }
};

module.exports = consoleExport;
