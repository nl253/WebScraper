const { existsSync } = require('fs');

const dbExport = require('./db');

/**
 * @param {String} [dbPath]
 * @param {Boolean} [doSync]
 * @param {*} [extraOpts]
 * @returns {function(String, String, String): Promise<void>}
 */
module.exports = (dbPath, doSync = false, extraOpts = {}) => {
  const p = dbPath || `db-${new Date().toISOString().replace(/\W+/g, '-')}.sqlite`;
  return dbExport(
    `sqlite:${p}`,
    doSync || !existsSync(p),
    { dialect: 'sqlite', ...extraOpts });
};
