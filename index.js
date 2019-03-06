#!/usr/bin/env node

const Spider = require('./spider');
const db = require('./db');

(async function() {
  await db.sequelize.sync({force: true})
  const s = new Spider('https://www.jobsite.co.uk/jobs/javascript');
  s.setExportFunct(async (url, sel, txt) => {
    try {
      return db.Result.create({txt, selector: sel, url});
    } catch (e) {
      console.error(e);
    }
  }).appendSelector(".job > .row > .col-sm-12")
     // don't look for jobs in London, make sure they are graduate!
    .setFilterFunct(txt => !!txt.match('raduate') && !txt.match('London'))
     // stop after 3 websites
    .setSiteCount(3)
     // next page 
    .appendFollowSelector(".results-footer-links-container ul.pagination li a[href*='page=']") 
     // run for 30 sec
    .setTimeLimit(30)
    .run();
})();