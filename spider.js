const path = require('path');
const url = require('url');
const {createWriteStream} = require('fs');

const cheerio = require('cheerio');
const fetch = require('node-fetch');

/**
 * @private
 * @param {*} o
 * @return {String}
 */
const getTypeName = o => o && o.constructor && o.constructor.name ? o.constructor.name : 'null';

/**
 * @private
 * @param {*} o
 * @param {String} type
 * @return {Boolean}
 */
const checkType = (o, type) => getTypeName(o) === type;

/**
 * @private
 * @param {*} o
 * @return {Boolean}
 */
const isSet = o => checkType(o, 'Set');

/**
 * @private
 * @param {*} o
 * @return {Boolean}
 */
const isObject = o => checkType(o, 'Object');

/**
 * Sleeps for sec seconds.
 *
 * @private
 * @param {Number} sec
 * @returns {Promise<void>}
 */
const sleep = (sec) => new Promise((res, rej) => setTimeout(res, sec * 1000));

/**
 * Constructs a path from parts.
 *
 * @private
 * @param {...String} parts
 * @returns {String}
 */
const rootPath = (...parts) => parts.reduce((x, y) => path.join(x, y), path.resolve('.'));

/**
 * Creates a function name based on variable name (v) and action name (f).
 *
 * @param {String} f action
 * @param {String} v variable
 * @returns {String} function name
 * @private
 */
const functName = (f, v) => f + v.slice(0, 1).toUpperCase() + v.slice(1).replace(/s$/, '');

class Spider {
  /**
   * @param {!String} start starting URL
   * @param {?Object} [opts]
   * @param {!Function} [opts.exportFunct]
   * @param {!Function} [opts.filterFunct]
   * @param {!Array<String>} [opts.followSelectors]
   * @param {!String} [opts.logErrFile]
   * @param {!String} [opts.logInfoFile]
   * @param {!Number} [opts.redirFollowCount]
   * @param {!Number} [opts.respSecW8]
   * @param {!Array<String>} [opts.selectors]
   * @param {!Number} [opts.resultCount]
   * @param {!Number} [opts.siteCount]
   * @param {!Number} [opts.threadCount]
   * @param {!Number} [opts.timeLimit]
   */
  constructor(start, opts = {}) {
    if (!start) {
      throw new Error('must give start URL');
    }

    const defaults = {
      exportFunct: async (_url, sel, txt) => null,
      filterFunct: (txt) => true,
      followSelectors: [],
      logErrFile: rootPath('errors.log'),
      logInfoFile: rootPath('log'),
      redirFollowCount: 3,
      respSecW8: 10,
      selectors: [],
      resultCount: 100,
      siteCount: 10, // #sites
      threadCount: 4,
      timeLimit: 60, // sec
    } = opts;

    this._jobs = [];
    this._queue = [start];
    this._sanitizeNLRegex = /\n{2,}/g;
    this._sanitizeRegex = /\s{2,}\n+|\n{2,}\s+/g;
    this._sanitizeWSRegex = /\s{2,}/g;
    this._seen = new Set();
    this._startTime = Date.now();

    this.exportFunct = defaults.exportFunct;
    this.filterFunct = defaults.filterFunct;
    this.followSelectors = defaults.followSelectors;
    this.logErrFile = defaults.logErrFile;
    this.logInfoFile = defaults.logInfoFile;
    this.redirFollowCount = defaults.redirFollowCount;
    this.respSecW8 = defaults.respSecW8;
    this.selectors = defaults.selectors;
    this.resultCount = defaults.resultCount;
    this.siteCount = defaults.siteCount;
    this.threadCount = defaults.threadCount;
    this.timeLimit = defaults.timeLimit;

    // Object.assign(this, Object.assign(defaults, opts));

    if (this.logInfoFile) {
      this._logInfoStream = createWriteStream(this.logInfoFile);
    }
    if (this.logErrFile) {
      this._logErrStream = createWriteStream(this.logErrFile);
    }

    for (const k of Object.keys(defaults).filter(k =>  k[0] !== '_' && this[k])) {
      let f;
      let fName;
      if (Array.isArray(this[k])) {
        fName = functName('append', k);
        f = function (val) {
          this[k].push(val);
          return this;
        };
      } else if (isSet(this[k])) {
        fName = functName('add', k);
        f = function (val) {
          this[k].add(val);
          return this;
        };
      } else if (['String', 'Number', 'RegExp', 'null', 'Function', 'AsyncFunction'].indexOf(getTypeName(this[k])) >= 0) {
        fName = functName('set', k);
        f = function (val) {
          this[k] = val;
          return this;
        };
      } else if (isObject(this[k])) {
        fName = functName('set', k);
        f = function (key, val) {
          this[k][key] = val;
          return this;
        };
      }

      if (fName !== undefined && f !== undefined) {
        Object.defineProperty(this, fName, { get() { return f.bind(this); } });
      }
    }
  }

  /**
   * Gets the joint selector.
   *
   * @returns {String} selector
   */
  get selector() { return this.selectors.join(', '); }

  /**
   * Gets the joint follow selector.
   *
   * @returns {String} followSelector
   */
  get followSelector() { return this.followSelectors.join(', '); }

  /**
   * Log an error msg to errorFile.
   *
   * @private
   * @param {{toString: function(): String}} msg
   */
  _logErr(msg) {
    if (this._logErrStream) {
      this._logErrStream.write(msg.toString());
      this._logErrStream.write('\n');
    } else console.error(msg);
  }

  /**
   * Log an error msg to errorFile.
   *
   * @private
   * @param {{toString: function(): String}} msg
   */
  _logInfo(msg) {
    if (this._logInfoStream) {
      this._logInfoStream.write(msg.toString());
      this._logInfoStream.write('\n');
    } else console.info(msg);
  }

  /**
   * Used to check if web-scraping should stop.
   * Emits useful message telling you what caused it to stop.
   *
   * @private
   * @returns {Promise<Boolean>} isFinished
   */
  async _isFinished() {

    let waited = 0;
    const maxWait = 10;

    // at the beginning, sometimes, all workers will be dispatched
    // and the queue becomes empty, but you don't want to end the program *yet*
    // wait for them to parse HTML, extract links and add them to the queue
    if (this._queue.length === 0 && this._jobs.length > 0) {
      const start = Date.now();
      while (this._queue.length === 0 && this._jobs.length > 0 && ((Date.now() - start) / 1000) <= maxWait) {
        await sleep(1);
        waited++;
      }
    }

    if (this._queue.length <= 0) {
      this._logInfo('queue is empty, stopping');
      return true;
    } else if (this.siteCount <= 0) {
      this._logInfo('scrape limit reached, stopping');
      return true;
    } else if (this.resultCount <= 0) {
      this._logInfo('scrape limit reached, stopping');
      return true;
    } else if (((Date.now() - this._startTime) / 1000) >= this.timeLimit) {
      this._logInfo('time limit reached, stopping');
      return true;
    }

    return waited >= maxWait;
  }

  /**
   * Worker used internally for scraping a single URL.
   *
   * @private
   * @returns {Promise<void>}
   */
  async _worker() {
    if (this.resultCount <= 0 || this.siteCount <= 0 || ((Date.now() - this._startTime) / 1000) >= this.timeLimit) {
      return;
    }
    const focusURL = this._queue.pop();

    // check if visited before
    if (this._seen.has(focusURL)) {
      this._logInfo(`skipping: ${focusURL} (already visited)`);
      return;
    }

    try {
      this._seen.add(focusURL);
      this._logInfo(`focus: ${focusURL}`);

      const res = await fetch(focusURL, {
        follow: this.redirFollowCount,
        timeout: this.respSecW8 * 1000, // ms
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/71.0.3578.98 Chrome/71.0.3578.98 Safari/537.36',
        },
      });

      // parse HTML
      const $ = cheerio.load(await res.text());

      const jobs = [];

      for (const sel of this.selectors) {
        this._logInfo(`selecting: ${sel}`);

        $(sel).each(async (idx, selResult) => {
          this._logInfo('found match');
          const txt =  $(selResult).text()
            .replace(this._sanitizeWSRegex, ' ')
            .replace(this._sanitizeRegex, '')
            .replace(this._sanitizeNLRegex, '\n');
          if (this.filterFunct(txt)) {
            jobs.push(this.exportFunct(focusURL, sel, txt));
            this.resultCount--;
          } else this._logInfo('filtered match');
        });
      }

      $(this.followSelector).each((i, elem) => {
        const resolved = url.resolve(focusURL, $(elem).attr('href'));
        if (!this._seen.has(resolved)) {
          console.log(`new url: ${resolved}`);
          this._queue.push(resolved);
        }
      });

      await Promise.all(jobs);
      this.siteCount--;

    } catch (e) {
      this._logErr(e);
    }
  }

  /**
   * Web-scrape.
   */
  async run() {
    this._logInfo(`start time: ${new Date(this._startTime)}`);
    this._logInfo(`root URL: ${this._queue[0]}`);

    while (!(await this._isFinished())) {
      if (this._jobs.length === this.threadCount) {
        await Promise.all(this._jobs);
        this._jobs = [];
        continue;
      }
      try {
        this._jobs.push(this._worker());
      } catch (e) {
        this._logErr(e);
      }
    }

    await Promise.all(this._jobs);

    this._jobs = [];
    this._seen.clear();
    if (this._logErrStream) this._logErrStream.close();
    if (this._logInfoStream) this._logInfoStream.close();
  }
}

module.exports = Spider;
