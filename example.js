/* eslint-disable */

const {
  Spider,
  exporting
} = require('./index');

(async function () {
  const s = new Spider('https://www.jobsite.co.uk/jobs/javascript');
  console.log(s);
  s.setExportFunct(await exporting.sqlite(true, './db'))
    .appendSelector(".job > .row > .col-sm-12")
    // don't look for jobs in London, make sure they are graduate!
    // .setFilterFunct(txt => !!txt.match('raduate') && !txt.match('London'))
    // stop after 3 websites
    .setSiteCount(3)
    // next page
    .appendFollowSelector(
      ".results-footer-links-container ul.pagination li a[href*='page=']")
    // run for 30 sec
    .setTimeLimit(30)
    .run();
})();
