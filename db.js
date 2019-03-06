const {join, dirname} = require('path');
const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  // - default ':memory:'
  storage: join(dirname(__filename), 'db'),
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
})

const Result = sequelize.define('Result', {
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
});

module.exports = {
  Result,
  Sequelize,
  sequelize,
};
