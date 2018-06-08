#!/usr/bin/env node

const fs = require('fs');
const cheerio = require('cheerio');
const url = require('url');
const fetch = require('fetch').fetchUrl;
const assert = require('assert');

class Spider {
  /**
   * @param {string} start starting URL
   */
  constructor(start) {
    // not to be modified
    this.queue = [start];
    this.results = {};
    this.seen = new Set();
    this.startTime = new Date();

    this.errorLog = 'errors.log';

    // need to be filled before running
    this.selectors = [];
    this.followSelectors = [];

    // defautl values
    this.toScrape = 10;
    this.outputFile = 'results.json';
    this.timeLimit = 60;
  }

  /**
   * Adds a selector to scrape text from.
   *
   * @returns {string}
   */
  select(newSelector) {
    this.selectors.push(newSelector);
    return this;
  }

  /**
   * Gets the joint selector.
   *
   * @returns {string}
   */
  get selector() {
    return this.selectors.join(', ');
  }

  /**
   * Log an error msg to errorFile.
   *
   * For internal use.
   *
   * @param {string} msg
   */
  logError(msg) {
    if (this.errorLog) {
      fs.appendFile(this.errorLog, `${msg}\n`, console.log);
    } else {
      console.error(msg);
    }
  }

  /**
   * Adds a selector to find links.
   *
   * @param {string} selector
   * @returns {Spider}
   */
  follow(selector) {
    this.followSelectors.push(selector);
    return this;
  }

  /**
   * Gets the joint follow selector.
   *
   * @returns {string}
   */
  get followSelector() {
    return this.followSelectors.join(', ');
  }

  /**
   * How many results to collect.
   *
   * @param {number} limitResultsTo
   * @returns {Spider}
   */
  limitResultsTo(max = 100) {
    this.toScrape = max;
    return this;
  }

  /**
   * Where to log errors.
   *
   * @param {string} fileName
   * @returns {Spider}
   */
  logErrorsTo(fileName = 'errors.log') {
    this.errorLog = fileName;
    return this;
  }

  /**
   * How long to scrape for.
   *
   * @param {number} secs
   * @returns {Spider}
   */
  limitTimeTo(secs = 30) {
    this.timeLimit = secs;
    return this;
  }

  /**
   * What file to write the results to.
   *
   * @param {string} fileName
   * @returns {Spider}
   */
  saveResultsTo(fileName = 'results.json') {
    this.outputFile = fileName;
    return this;
  }

  /**
   * Used to check if web-scraping should stop.
   * Emits useful message telling you what caused it to stop.
   *
   * @returns {boolean}
   */
  isFinished() {
    if (this.queue.length <= 0) {
      console.info('queue is empty, stopping');
      return true;
    } else if (this.toScrape <= 0) {
      console.info('scrape limit reached, stopping');
      return true;
    } else if (((new Date() - this.startTime) / 1000) >= this.timeLimit) {
      console.info('time limit reached, stopping');
      return true;
    }
    return false;
  }

  /**
   * Save collected results to specified (or default) output file.
   */
  saveResults() {
    const output = JSON.stringify(this.results);

    if (this.outputFile) {
      // write to specified (or default) file
      fs.writeFile(this.outputFile, output, console.log);
    } else console.log(output);
  }

  /**
   * Begin web-scraping.
   *
   * @returns {Object} result
   */
  run() {
    if (!this.isFinished()) {
      const focusURL = this.queue.pop();

      // check if visitied before
      if (this.seen.has(focusURL)) {
        this.logError(`[skipping] ${focusURL} (already visitied)`);
        return this.run();
      }

      return fetch(focusURL, {
        outputEncoding: 'utf-8',
        maxRedirects: 3,
        timeout: 5 * 1000 // ms
      }, (err, meta, HTML) => {
        console.info(`[focus] ${focusURL}`);

        this.seen.add(focusURL);

        if (err) {
          this.logError(err);
          return this.run();
        }

        // parse HTML
        const $ = cheerio.load(HTML);

        for (const selector of this.selectors) {

          const thisSelectorResults = $(selector).text();

          if (thisSelectorResults) {
            if (!Object.keys(this.results).includes(focusURL)) {
              this.results[focusURL] = {};
            }
            console.debug(`found results on ${focusURL}`);
            this.results[focusURL][selector] = thisSelectorResults;
          }
        }

        $(this.followSelector).each((i, elem) => {
          let resolved = url.resolve(focusURL, $(elem).attr('href'));
          if (!this.seen.has(resolved)) this.queue.push(resolved);
        });

        return this.run();
      });
    }
    // else
    this.saveResults();
    this.seen.clear();
    return this.results;
  }
}

 
new Spider('https://www.jobsite.co.uk/jobs/javascript')
  .select('p.job-intro.is-truncated')         
  .follow("a[href*='page=']") // next page 
  .limitResultsTo(500)
  .limitTimeTo(120)
  .run();
