const url = require('url');
const { createWriteStream } = require('fs');

const cheerio = require('cheerio');
const fetch = require('node-fetch');

const REGEX_URL = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

/**
 * @private
 * @param {*} o
 * @returns {String}
 */
const getTypeName = (o) => o && o.constructor && o.constructor.name ? o.constructor.name : 'null';

/**
 * @private
 * @param {*} o
 * @param {String} type
 * @returns {Boolean}
 */
const checkType = (o, type) => getTypeName(o) === type;

/**
 * @private
 * @param {*} o
 * @returns {Boolean}
 */
const isSet = (o) => checkType(o, 'Set');

/**
 * @private
 * @param {*} o
 * @returns {Boolean}
 */
const isObject = (o) => checkType(o, 'Object');

/**
 * Sleeps for sec seconds.
 *
 * @private
 * @param {Number} sec
 * @returns {Promise<void>}
 */
const sleep = (sec) => new Promise((res, rej) => setTimeout(res, sec * 1000));

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

    this._jobs = [];
    this._queue = [start];
    this._sanitizeNLRegex = /\n{2,}/g;
    this._sanitizeRegex = /\s{2,}\n+|\n{2,}\s+/g;
    this._sanitizeWSRegex = /\s{2,}/g;
    this._seen = new Set();
    this._startTime = Date.now();

    this.exportFunct = opts.exportFunct || (() => Promise.resolve(null));
    this.filterFunct = opts.filterFunct || ((txt) => true);
    this.followSelectors = opts.followSelectors || [];
    this.redirFollowCount = opts.redirFollowCount || 3;
    this.respSecW8 = opts.respSecW8 || 10;
    this.selectors = opts.selectors || [];
    this.resultCount = opts.resultCount || 100;
    this.siteCount = opts.siteCount || 10;
    this.threadCount = opts.threadCount || 4;
    this.timeLimit = opts.timeLimit || 60;

    if (opts.logInfoFile) {
      const logInfoStream = createWriteStream(opts.logInfoFile);
      this._logInfo = (msg) => {
        logInfoStream.write('INFO ');
        logInfoStream.write(msg.toString());
        logInfoStream.write('\n');
      };
    } else {
      this._logInfo = console.info;
    }

    if (opts.logErrFile) {
      const logErrStream = createWriteStream(opts.logErrFile);
      this._logErr = (msg) => {
        logErrStream.write('ERROR ');
        logErrStream.write(msg.toString());
        logErrStream.write('\n');
      };
    } else {
      this._logErr = console.error;
    }

    for (const k of Object.keys(this).filter((prop) => ['run', 'followSelector', 'selector'].indexOf(prop) < 0 && prop[0] !== '_' && this[prop])) {
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
      } else if ([
        'String', 'Number', 'RegExp', 'null', 'Function', 'AsyncFunction'
      ].indexOf(getTypeName(this[k])) >= 0) {
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
   * Used to check if web-scraping should stop.
   * Emits useful message telling you what caused it to stop.
   *
   * @private
   * @returns {Promise<Boolean>} isFinished
   */
  async _isFinished() {

    let waited = 0;
    const maxWait = 10;

    /*
     * at the beginning, sometimes, all workers will be dispatched
     * and the queue becomes empty, but you don't want to end the program *yet*
     * wait for them to parse HTML, extract links and add them to the queue
     */
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

    this._seen.add(focusURL);
    this._logInfo(`focus: ${focusURL}`);

    let $;

    try {
      const res = await fetch(focusURL, {
        follow: this.redirFollowCount,
        timeout: this.respSecW8 * 1000, // ms
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/71.0.3578.98 Chrome/71.0.3578.98 Safari/537.36',
          DNT: '1',
        },
      });
      $ = cheerio.load(await res.text());
    } catch (e) {
      this._logErr(e.message || e.toString());
      return;
    }

    const jobs = [];
    for (const sel of this.selectors) {
      this._logInfo(`selecting: ${sel}`);
      $(sel).each((idx, selResult) => {
        const txt = $(selResult)
          .text()
          .replace(this._sanitizeWSRegex, ' ')
          .replace(this._sanitizeRegex, '')
          .replace(this._sanitizeNLRegex, '\n');
        if (this.filterFunct(txt)) {
          this._logInfo('found match');
          jobs.push(this.exportFunct(focusURL, sel, txt));
          this.resultCount--;
        } else {
          this._logInfo('filtered match');
        }
      });
    }

    $(this.followSelector).each((idx, elem) => {
      // eslint-disable-next-line node/no-deprecated-api
      const resolved = url.resolve(focusURL, $(elem).attr('href'));
      if (!this._seen.has(resolved)) {
        if (REGEX_URL.test(resolved)) {
          this._logInfo(`new url: ${resolved}`);
          this._queue.push(resolved);
        } else {
          this._logInfo(`resolved URL wasn't valid (${resolved})`);
        }
      }
    });

    // eslint-disable-next-line no-empty
    while (await jobs.pop()) {}
    this.siteCount--;
  }

  /**
   * Web-scrape.
   */
  async run() {
    this._logInfo(`start time: ${new Date(this._startTime)}`);
    this._logInfo(`root URL: ${this._queue[0]}`);

    while (!(await this._isFinished())) {
      if (this._jobs.length >= this.threadCount) {
        // eslint-disable-next-line no-empty
        while (await this._jobs.pop()) {}
        continue;
      }
      this._jobs.push(this._worker());
    }

    // eslint-disable-next-line no-empty
    while (await this._jobs.pop()) {}
    this._seen.clear();
  }
}

module.exports = Spider;
