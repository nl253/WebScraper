/* eslint-disable */

const {
  Spider,
  exporting
} = require('./index');

(async function () {
  try {
    const s = new Spider('https://www.jobsite.co.uk/jobs/javascript');
    s.appendSelector(".job > .row > .col-sm-12")
      // don't look for jobs in London, make sure they are graduate!
      // .setFilterFunct(text => !!text.match('raduate') && !text.match('London'))
      // stop after 3 websites
      .setSiteCount(3)
      // next page
      .appendFollowSelector(
        ".results-footer-links-container ul.pagination li a[href*='page=']")
      // run for 30 sec
      .setTimeLimit(30)
      .run();
  } catch (e) {
    console.error(e);
  }
})();
