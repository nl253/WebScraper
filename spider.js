const url = require('url');
const { createWriteStream } = require('fs');

const cheerio = require('cheerio');
const fetch = require('node-fetch');

const exporting = require('./exporting');

const REGEX_URI = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
const SEC = 1000;

/**
 * Sleeps for sec seconds.
 *
 * @private
 * @param {Number} sec
 * @returns {Promise<void>}
 */
const sleep = (sec) => new Promise((res, rej) => setTimeout(res, sec * SEC));

class Spider {
  /**
   * @param {!String} start starting URI
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
      throw new Error('must give start URI');
    }

    this._jobs = [];
    this._queue = [start];
    this._sanitizeNLRegex = /\n{2,}/g;
    this._sanitizeRegex = /\s{2,}\n+|\n{2,}\s+/g;
    this._sanitizeWSRegex = /\s{2,}/g;
    this._seen = new Set();
    this._startTime = Date.now();

    this.exportFunct = opts.exportFunct || exporting.default;
    this.filterFunct = opts.filterFunct || ((text) => true);
    this.followSelectors = opts.followSelectors || [];
    this.redirFollowCount = opts.redirFollowCount || 3;
    this.respSecW8 = opts.respSecW8 || 10;
    this.selectors = opts.selectors || [];
    this.resultCount = opts.resultCount || 100;
    this.siteCount = opts.siteCount || 10;
    this.threadCount = opts.threadCount || 4;
    this.timeLimit = opts.timeLimit || 60;

    this._logInfo = this._initLogToFile(opts.logInfoFile, 'info');
    this._logErr = this._initLogToFile(opts.logErrFile, 'error');
  }

  /**
   * @param {Number} n
   * @returns {Spider}
   */
  setTimeLimit(n) { return this._set('timeLimit', n); }

  /**
   * @param {Number} n
   * @returns {Spider}
   */
  setRedirFollowCount(n) { return this._set('redirFollowCount', n); }

  /**
   * @param {Number} n
   * @returns {Spider}
   */
  setRespSecW8(n) { return this._set('respSecW8', n); }

  /**
   * @param {Number} n
   * @returns {Spider}
   */
  setResultCount(n) { return this._set('resultCount', n); }

  /**
   * @param {Number} n
   * @returns {Spider}
   */
  setSiteCount(n) { return this._set('siteCount', n); }

  /**
   * @param {Number} n
   * @returns {Spider}
   */
  setThreadCount(n) { return this._set('threadCount', n); }

  /**
   * @param {function(String, String, String): Promise<void>} f
   * @returns {Spider}
   */
  setExportFunct(f) { return this._set('exportFunct', f); }

  /**
   * @param {function(String): Boolean} f
   * @returns {Spider}
   */
  setFilterFunct(f) { return this._set('filterFunct', f); }

  /**
   * @param {String} s
   * @returns {Spider}
   */
  appendSelector(s) { return this._append('selectors', s); }

  /**
   * @param {String|String[]} s
   * @returns {Spider}
   */
  setSelector(s) {
    if (Array.isArray(s)) {
      return this._set('selector', s);
    } else {
      return this.setSelector([s]);
    }
  }

  /**
   * @param {String} s
   * @returns {Spider}
   */
  appendFollowSelector(s) { return this._append('followSelectors', s); }

  /**
   * @param {String|String[]} s
   * @returns {Spider}
   */
  setFollowSelector(s) { return this._set('followSelectors', Array.isArray(s) ? s : [s]); }

  /**
   * @param {String} fName
   * @returns {Spider}
   */
  setLogInfoFile(fName) {
    this._logInfo = this._initLogToFile(fName, 'info');
    return this;
  }

  /**
   * @param {String} fName
   * @returns {Spider}
   */
  setLogErrFile(fName) {
    this._logErr = this._initLogToFile(fName, 'error');
    return this;
  }

  /**
   * @param {?String} fName
   * @param {'info'|'error'} lvl
   * @returns {function(...String): void}
   * @private
   */
  _initLogToFile(fName, lvl = 'info') {
    if (!fName) {
      return this._initLogToFile(`log-${new Date().toISOString().replace(/\W+/g, '-')}.log`);
    }
    const stream = createWriteStream(fName);
    return (msg) => {
      stream.write(lvl.toUpperCase());
      stream.write(' ');
      stream.write(msg.toString());
      stream.write('\n');
    };
  }

  /**
   * @param {String} prop
   * @param {*} val
   * @returns {Spider}
   * @private
   */
  _set(prop, val) {
    this[prop] = val;
    return this;
  }

  /**
   * @param {String} prop
   * @param {*} val
   * @returns {Spider}
   * @private
   */
  _append(prop, val) {
    this[prop].push(val);
    return this;
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
      while (this._queue.length === 0 && this._jobs.length > 0 && ((Date.now() - start) / SEC) <= maxWait) {
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
    } else if (((Date.now() - this._startTime) / SEC) >= this.timeLimit) {
      this._logInfo('time limit reached, stopping');
      return true;
    }

    return waited >= maxWait;
  }

  /**
   * Worker used internally for scraping a single URI
   *
   * @private
   * @returns {Promise<void>}
   */
  async _worker() {
    if (this.resultCount <= 0 || this.siteCount <= 0 || ((Date.now() - this._startTime) / SEC) >= this.timeLimit) {
      return;
    }
    const focusURI = this._queue.pop();

    // check if visited before
    if (this._seen.has(focusURI)) {
      this._logInfo(`skipping: ${focusURI} (already visited)`);
      return;
    }

    this._seen.add(focusURI);
    this._logInfo(`focus: ${focusURI}`);

    let $;

    try {
      const res = await fetch(focusURI, {
        follow: this.redirFollowCount,
        timeout: this.respSecW8 * SEC, // ms
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/71.0.3578.98 Chrome/71.0.3578.98 Safari/537.36',
          DNT: '1',
        },
      });
      const html = await res.text();
      $ = cheerio.load(html);
    } catch (e) {
      this._logErr(e.message || e.toString());
      return;
    }

    const jobs = [];
    for (const selector of this.selectors) {
      this._logInfo(`selecting: ${selector}`);
      $(selector).each((idx, selResult) => {
        const text = $(selResult)
          .text()
          .replace(this._sanitizeWSRegex, ' ')
          .replace(this._sanitizeRegex, '')
          .replace(this._sanitizeNLRegex, '\n');
        if (this.filterFunct(text)) {
          this._logInfo('found match');
          jobs.push(this.exportFunct(focusURI, selector, text));
          this.resultCount--;
        } else {
          this._logInfo('filtered match');
        }
      });
    }

    $(this.followSelector).each((idx, elem) => {
      // eslint-disable-next-line node/no-deprecated-api
      const resolved = url.resolve(focusURI, $(elem).attr('href'));
      if (!this._seen.has(resolved)) {
        if (REGEX_URI.test(resolved)) {
          this._logInfo(`new URI: ${resolved}`);
          this._queue.push(resolved);
        } else {
          this._logInfo(`resolved URI wasn't valid (${resolved})`);
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
    this._logInfo(`root URI: ${this._queue[0]}`);

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
