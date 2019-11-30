/* eslint-disable global-require */
const exporting = {
  sqlite: require('./sqlite'),
  console: require('./console'),
  file: require('./file'),
  combine: require('./combine'),
};

exporting.default = exporting.combine(exporting.console());

module.exports = exporting;
