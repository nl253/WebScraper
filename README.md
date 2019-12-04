# Web Scraper

- CSS selectors
- exporting function
- pre-configured to insert results into SQLite database and generate CSV
- stop conditions:
  - time
  - number of results
  - number of websites
- filter function to check for results
- post- and pre-processing functions
- init with options or set them later with `spider.setVal1(v).setVal2(v2)`
- builder (call chaining) design pattern
- extensible

## API 

Docs in <a href="https://nl253.github.io/WebScraper/">gh-pages</a>.

```js
const startURL = "https://stackoverflow.com/questions/...";
const crawler = new Spider(startURL);
crawler.setRespSecW8(20)
       .appendSelector('p.info')
       .appendSelector('p.more-info')
       .appendFollowSelector('.btn.next')
       .appendFollowSelector('.btn.next-page')
       .setPostProcessTextFunct(text => text.replace('mother', 'yes'))
       .setFilterFunct(txt => !!txt.match('sunflower'))
       .setTimeLimit(120) // sec
       .setThreadCount(8) // #workers
       .setSiteCount(100) // distinct URLs
       // run returns void, you might want to provide an export function for each result (see below)
       // by default goes to sqlite ./db and prints to console
       .run(); 
```

<p>OR use init object in the constructor</p>

```js
// DEFAULT init options
const spiderOpts = {
  // Function<String, String, String, Promise>
  exportFunct: exports.combine(exports.console(), exports.sqlite()),
  // predicate i.e. Function<String, Boolean>
  filterFunct: (txt) => true, 
  // Array<String>
  followSelectors: [], 
  // String
  logInfoFile: undefined, // logging goes to console
  // String
  logInfoFile: undefined, // logging goes to console
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


```js
const startURL = "https://stackoverflow.com/questions/...";
const crawler = new Spider(startURL);
crawler.setRespSecW8(20)
       .appendSelector('p.info')
       .appendSelector('p.more-info')
       .appendFollowSelector('.btn.next')
       .appendFollowSelector('.btn.next-page')
       .setPostProcessTextFunct(text => text.replace('mother', 'yes'))
       .setFilterFunct(txt => !!txt.match('sunflower'))
       .setTimeLimit(120) // sec
       .setThreadCount(8) // #workers
       .setSiteCount(100) // distinct URLs
       // run returns void, you might want to provide an export function for each result (see below)
       // by default goes to sqlite ./db and prints to console
       .run(); 
```

See export functions below to save results.

## Export Function

Must be of type `(uri: string, selector: string, text: string) => Promise<*>`.
There is a few configurable export functions that you can use:

Import the exporting module:

```js
const { exporting, Spider }  = require('simple-webscraper');
```

Declare a spider:

```js
const spider = new Spider(uri, { /* opts */ });
```

- `sqlite`

  Generates a `Result` table with columns: `id INT`, `text TEXT`, `selector TEXT`, `uri TEXT` columns.

  ```js
  spider.setExportFunct(exporting.sqlite()) // generate output db name
        .run();
  ```
  
  ```js
  spider.setExportFunct(exporting.sqlite('my-database.sqlite'))
        .run();
  ```

- `console`

  ```js
  spider.setExportFunct(exporting.console()) // default formatter
        .run();
  ```
  
  ```js
  spider.setExportFunct(exporting.console('%s :: %s => %s')) // string formatter for (uri, selector, text)
        .run();
  ```
  
  ```js
  spider.setExportFunct(exporting.console((uri, selector, text) => `${uri} :: ${text.slice(0, 100)}`))
        .run();
  ```

- `file`

  ```js
  spider.setExportFunct(exporting.file()) // default file name, default formatter
        .run();
  ```
  
  ```js
  spider.setExportFunct(exporting.file('results.csv')) // custom file name, default csv formatter
        .run();
  ```
  
  ```js
  spider.setExportFunct(exporting.file('results.log', 'INFO %s, %s, %s')) // custom file name, string formatter
        .run();
  ```
  
  ```js
  spider.setExportFunct(exporting.file('results.log', (uri, selector, text) => `${uri} :: ${text.slice(0, 100)}`))
        .run();
  ```


- `combine` (used to broadcast results to many exports)

  ```js
  spider.setExportFunct(exporting.combine(
      exporting.sqlite(), 
      exporting.console(), 
      exporting.file(),
    )).run();
  ```

- `db`

  ```js
  spider.setExportFunct(exporting.db(dbURI)) // look at sequelize docs
        .run();
  ```

- `default` (enabled by default, sends to console, CSV file and sqlite database)

<p>It's <strong>very</strong> easy to define your own export function. E.g. imagine wanting to POST each result to some 3rd party API.</p>   

```js
const myExportFunction = async (uri, selector, text) => {
  const res = await http.post(myURI, { uri, selector, text });
  return;
};
```

## Example

More examples in `./examples`.

```js
const { Spider, exporting } = require('simple-webscraper');

(async function() {
  const s = new Spider('https://www.jobsite.co.uk/jobs/javascript');

  const sqliteExport = await exporting.sqlite('./db', true /* force wipe if exists */);

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
