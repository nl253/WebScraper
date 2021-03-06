const { Spider, exporting } = require('..');

new Spider('https://github.com/search?o=desc&q=rust&s=stars&type=Repositories')
  .setSiteCount(10)
  .appendSelector('.repo-list-item')
  .appendFollowSelector(".codesearch-pagination-container a[href^='/search']:last-of-type")
  .setExportFunct(exporting.combine(exporting.console(), exporting.sqlite()))
  .setResultCount(500)
  .setTimeLimit(60)
  .setThreadCount(4)
  .setRespSecW8(5)
  .run()
  .catch(console.error);
