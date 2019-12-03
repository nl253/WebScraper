/* eslint-disable global-require */
const exporting = {
  db: require('./db'),
  sqlite: require('./sqlite'),
  console: require('./console'),
  file: require('./file'),
  combine: require('./combine'),
};

exporting.default = exporting.combine(
  exporting.console(),
  exporting.file(),
  exporting.sqlite(),
);

module.exports = exporting;
