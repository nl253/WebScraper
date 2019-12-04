const Sequelize = require('sequelize');

let cacheDB;

/**
 * @param {string} connectionStr
 * @param {Partial<sequelize.Options>} [dbOpts]
 * @returns {Promise<sequelize.Sequelize>}
 * @private
 */
const getDB = async (connectionStr, dbOpts = {}) => {
  if (cacheDB === undefined) {
    cacheDB = new Sequelize(connectionStr, {
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      ...dbOpts });
    await cacheDB.sync();
    await cacheDB.authenticate();
    console.log('Connection to database has been established successfully.');
  }
  return cacheDB;
};

let cacheResultTbl;

/**
 * @param {sequelize.Sequelize} db
 * @param {boolean} [doSync]
 * @param {Partial<sequelize.ModelOptions>} [modelOpts]
 * @returns {Promise<sequelize.Model>}
 * @private
 */
const getResultTbl = async (db, doSync = false, modelOpts = {}) => {
  if (cacheResultTbl === undefined) {
    cacheResultTbl = db.define('Result', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      selector: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      uri: {
        type: Sequelize.STRING,
        allowNull: false,
      }
    }, {
      freezeTableName: true,
      ... modelOpts,
    });
    await cacheResultTbl.sync({ force: doSync });
  }
  return cacheResultTbl;
};

/**
 * @param {string} connectionStr
 * @param {boolean} [doSync]
 * @param {Partial<sequelize.Options>} [dbOpts]
 * @param {Partial<sequelize.ModelOptions>} [modelOpts]
 * @returns {ExportFunct}
 */
const dbExport = (connectionStr, doSync = false, dbOpts = {}, modelOpts = {}) => async (uri, selector, text) => (await getResultTbl(await getDB(connectionStr, dbOpts), doSync, modelOpts)).create({ text, selector, uri });

module.exports = dbExport;
