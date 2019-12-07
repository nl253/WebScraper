const { existsSync } = require('fs');

const dbExport = require('./db');

/**
 * @param {string} [dbPath]
 * @param {boolean} [doSync]
 * @param {Partial<sequelize.Options>} [dbOpts]
 * @param {Partial<ModelOptions>} [modelOpts]
 * @returns {ExportFunct}
 */
const sqliteExport = (dbPath, doSync = false, dbOpts = {}, modelOpts = {}) => {
  const p = dbPath || `db-${new Date().toISOString().replace(/\W+/g, '-')}.sqlite`;
  return dbExport(
    `sqlite:${p}`,
    doSync || !existsSync(p),
    { dialect: 'sqlite', ...dbOpts },
    modelOpts,
  );
};

module.exports = sqliteExport;
