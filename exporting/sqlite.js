module.exports = async function (doSync = false, dbPath = './db') {

  const Sequelize = require('sequelize');
  const fs = require('fs');

  const sequelize = new Sequelize('database', 'username', 'password', {
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
  });

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

  if (doSync || !fs.existsSync(dbPath)) {
    await sequelize.sync({force: true})
  }

  return (url, sel, txt) => {
    try {
      return Result.create({txt, selector: sel, url});
    } catch (e) {
      console.error(e);
    }
  };
};
