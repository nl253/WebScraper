const { existsSync } = require('fs');

const Sequelize = require('sequelize');


let cacheDB;

/**
 * @param {String} dbPath
 * @returns {sequelize.Sequelize}
 */
const getDB = (dbPath) => cacheDB === undefined ? new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  // - default ':memory:'
  storage: dbPath,
  // transactionType: Sequelize.Transaction.TYPES.IMMEDIATE,
  retry: {
    max: 10,
  },
  pool: {
    max: 200,
    idle: 30000,
    acquire: 5000,
    evict: 3000,
  },
}) : cacheDB;

let cacheResultTbl;

/**
 * @param {sequelize.Sequelize} db
 * @returns {sequelize.Model}
 */
const getResultTbl = (db) => cacheResultTbl === undefined ? db.define('Result', {
  id: {
    primaryKey: true,
    autoIncrement: true,
    type: Sequelize.INTEGER,
  },
  txt: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  selector: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  url: {
    type: Sequelize.STRING,
    allowNull: false,
  }
}) : cacheResultTbl;

/**
 * @param {String} [dbPath]
 * @param {Boolean} [doSync]
 * @returns {function(Boolean, String): function(String, String, String): Promise<void>}
 */
module.exports = async function (dbPath = './db', doSync = false) {
  const db = getDB(dbPath);

  if (doSync || !existsSync(dbPath)) {
    await db.sync({ force: true });
  }

  const ResultTbl = getResultTbl(db);

  return (url, sel, txt) => ResultTbl.create({ txt, selector: sel, url });
};
