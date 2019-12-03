const Sequelize = require('sequelize');

let cacheDB;

/**
 * @param {String} connectionStr
 * @param {*} [opts]
 * @returns {Promise<sequelize.Sequelize>}
 */
const getDB = async (connectionStr, opts = {}) => {
  if (cacheDB === undefined) {
    cacheDB = new Sequelize(connectionStr, {
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      ...opts });
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
 * @param {*} [opts]
 * @returns {Promise<sequelize.Model>}
 */
const getResultTbl = async (db, doSync = false, opts = {}) => {
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
      ... opts,
    });
    await cacheResultTbl.sync({ force: doSync });
  }
  return cacheResultTbl;
};

/**
 * @param {String} connectionStr
 * @param {Boolean} [doSync]
 * @param {*} [opts]
 * @returns {function(String, String, String): Promise<void>}
 */
module.exports = (connectionStr, doSync = false, opts = {}) => async (uri, selector, text) => (await getResultTbl(await getDB(connectionStr, opts), doSync, opts)).create({ text, selector, uri });
