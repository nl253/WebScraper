# Web Scraper

- CSS selectors
- inserts results into SQLite database
- stop conditions:
  - time
  - number of results
  - number of websites
  - filter function to check for results
- init with options or set them later with `spider.setVal1(v).setVal2(v2)`
- builder (call chaining) design pattern

## API 

```js
// DEFAULT init options
const spiderOpts = {
  // Function<String, String, String, Promise>
  exportFunct: async (url, sel, txt) => null,
  // predicate i.e. Function<String, Boolean>
  filterFunct: (txt) => true, 
  // Array<String>
  followSelectors: [], 
  // String
  logErrFile: './errors.log',
  // String
  logInfoFile: './log',
  // Integer
  redirFollowCount: 3,
  // Integer
  respSecW8: 10,
  // Array<String>
  selectors: [], 
  // Integer
  resultCount: 100,
  // Integer
  siteCount: 10, // #sites
  // Integer
  threadCount: 4,
  // Integer
  timeLimit: 60, // sec
};

const startURL = "https://stackoverflow.com/questions/...";
const crawler = new Spider(startURL, spiderOpts);
crawler.run();
```

<p>OR use methods to modify options (OPTIONAL, you can set them on init)</p>

```js
const startURL = "https://stackoverflow.com/questions/...";
const crawler = new Spider(startURL);
crawler.setLogErrFile('msgs-err.log')
       .setLogInfoFile('msgs-info.log')
       .setRespSecW8(20)
       .setRespSecW8(10)
       .appendSelector('p.info')
       .appendSelector('p.more-info')
       .appendFollowSelector('.btn.next')
       .appendFollowSelector('.btn.next-page')
       .setFilterFunct(txt => !!txt.match('sunflower'))
       .setTimeLimit(120) // sec
       .setThreadCount(8)
       .setSiteCount(100) // distinct URLs
       // run returns void, you need to prodive an export function for each result (see below)
       .run(); 
```

See export functions below to save results.

### Export Function

Must be of type `(url: String, sel: String, txt: String) => Promise<*>`.
There is an SQLite export function defined in `./exporting/sqlite` which you can import, initialise and register.

**NOTE** Results will be in `./db`.         

```js
const {Spider, exporting} = require('simple-webscraper');

(async function() {
  const s = new Spider('https://www.jobsite.co.uk/jobs/javascript');
  // doForce: Boolean, dbPath: String 
  const sqliteExport = await exporting.sqlite(true, './db');
  s.setExportFunct(sqliteExport)
   .appendSelector(".job > .row > .col-sm-12")
    // don't look for jobs in London, make sure they are graduate!
   .setFilterFunct(txt => !!txt.match('raduate') && !txt.match('London'))
    // next page 
   .appendFollowSelector(".results-footer-links-container ul.pagination li a[href*='page=']") 
    // stop after 3 websites (urls)
   .setSiteCount(3)
    // run for 30 sec
   .setTimeLimit(30)
   .run();
})();
```
