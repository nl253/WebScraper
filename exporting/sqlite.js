const fs = require('fs');
const { promisify } = require('util');

const Sequelize = require('sequelize');

const exists = promisify(fs.exists);

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
 * @param {Boolean} [doSync]
 * @param {String} [dbPath]
 * @returns {Promise<function(*, *, *): void>}
 */
module.exports = async function (doSync = false, dbPath = './db') {
  const db = getDB(dbPath);

  if (doSync || !(await exists(dbPath))) {
    await db.sync({ force: true });
  }

  const ResultTbl = getResultTbl(db);

  return (url, sel, txt) => ResultTbl.create({ txt, selector: sel, url });
};
