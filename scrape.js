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
    this._queue = [start];
    this.results = {};
    this._startTime = new Date();

    // need to be filled before running
    this.selectors = [];
    this.followSelectors = [];

    // defautl values
    this.toScrape = 10;
    this.outputFile = 'results.json';
    this._timeout = 60;
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
   * @param {number} maxResults
   * @returns {Spider}
   */
  limit(maxResults = 100) {
    this.toScrape = maxResults;
    return this;
  }

  /**
   * How long to scrape for
   *
   * @param {number} secs
   * @returns {Spider}
   */
  timeout(secs = 30) {
    this._timeout = secs;
    return this;
  }

  /**
   * What file to write the results to.
   *
   * @param {string} fileName
   * @returns {Spider}
   */
  write(fileName = 'results.json') {
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
    if (this._queue.length <= 0) {
      console.info('queue is empty, stopping');
      return true;
    } else if (this.toScrape <= 0) {
      console.info('scrape limit reached, stopping');
      return true;
    } else if (((new Date() - this._startTime) / 1000) >= this._timeout) {
      console.info('time limit reached, stopping');
      return true;
    } return false;
  }

  _sanitiseResults() {
    // clear redundant data
    for (const url in this.results) {
      for (const selector of this.selectors) {
        if (this.results[url][selector].length === 0) {
          /*
           * wipe empty entries
           * used to keep track of visitied sites
           */
          delete this.results[url][selector];
        }
      }
      if (Object.values(this.results[url]).length === 0) {
        delete this.results[url];
      }
    }
  }

  _saveResults() {
    // write to specified (or default) file
    fs.writeFile(this.outputFile, JSON.stringify(this.results), console.log);
  }

  run() {
    if (!this.isFinished()) {
      const focusURL = this._queue.pop();
      console.info(`[focus] ${focusURL}`);

      // check if visitied before
      if (focusURL in this.results) {
        console.info(`[skipping] ${focusURL} (already visitied)`);
        return this.run();
      }

      return fetch(focusURL, (err, meta, HTML) => {
        if (err) {
          console.error(err);
          return this.run();
        }

        // parse HTML
        const $ = cheerio.load(HTML);

        // make a marker entry
        this.results[focusURL] = {};

        for (const selector of this.selectors) {
          // every selector has a list of findings
          if (!this.results[focusURL][selector]) {
            this.results[focusURL][selector] = [];
          }
          $(selector).each((i, el) => {
            this.results[focusURL][selector].push($(el).text());
            this.toScrape--;
          });
        }

        // enqueue links
        $(this.followSelector).each((i, elem) => {
          const resolved = url.resolve(focusURL, $(elem).attr('href'));
          console.debug(`[adding] ${resolved}`);
          this._queue.push(resolved);
        });

        return this.run();
      });
    }
    // else
    this._sanitiseResults();
    this._saveResults();
    return this.results;
  }
}

new Spider('https://www.indeed.co.uk/jobs?q=graduate+front+end+developer&start=10')
  .select('#job_summary')
  .follow('a.jobtitle.turnstileLink')
  .limit(200)
  .follow("a[href*='front+end+developer']")
  .run();
