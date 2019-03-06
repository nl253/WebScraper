const {createWriteStream} = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const url = require('url');
const fetch = require('node-fetch');

module.exports = class Spider {
  /**
   * @param {!String} start starting URL
   * @param {?Object} [opts]
   */
  constructor(start, opts = {}) {
    if (!start) throw new Error('must give start URL');

    function rootPath(...parts) {
      return parts.reduce(
        (x, y) => path.join(x, y), 
        path.dirname(path.resolve(__filename))); 
    }

    const defaults = {
      _jobs: [],
      _queue: [start],
      _sanitizeNLRegex: /\n{2,}/g,
      _sanitizeRegex: /\s{2,}\n+|\n{2,}\s+/g,
      _sanitizeWSRegex: /\s{2,}/g,
      _seen: new Set(),
      _startTime: Date.now(),
      exportFunct: async (url, sel, txt) => null,
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
    };

    Object.assign(this, Object.assign(defaults, opts));

    if (this.logInfoFile) {
      this._logInfoStream = createWriteStream(this.logInfoFile);
    }
    if (this.logErrFile) {
      this._logErrStream = createWriteStream(this.logErrFile);
    }

    function makeName(f, v) {
      return f + v.slice(0, 1).toUpperCase() + v.slice(1).replace(/s$/, '')
    }

    for (const k of Object.keys(defaults).filter(k => !k.startsWith('_')).filter(k => !!this[k])) {
      const type = this[k] !== null 
          ? this[k].constructor.name 
          : 'null';
      if (type === 'Array') {
        this[makeName('append', k)] =
          function (val) {
            this[k].push(val);
            return this;
          };
      } else if (type === 'Set') {
        this[makeName('add', k)] =
          function (val) {
            this[k].add(val);
            return this;
          };
      } else if (['String', 'Number', 'RegExp', 'null', 'Function', 'AsyncFunction'].indexOf(type) >= 0) {
        this[makeName('set', k)] =
          function (val) {
            this[k] = val;
            return this;
          };
      } else if (type === 'Object') {
        this[makeName('set', k)] =
          function (key, val) {
            this[k][key] = val;
            return this;
          };
      }
    }
  }

  /**
   * Gets the joint selector.
   *
   * @returns {String} selector
   */
  get selector() {
    return this.selectors.join(', ');
  }

  /**
   * Gets the joint follow selector.
   *
   * @returns {String} followSelector
   */
  get followSelector() {
    return this.followSelectors.join(', ');
  }

  /**
   * Log an error msg to errorFile.
   *
   * For internal use.
   *
   * @param {Object} msg
   * @private
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
   * For internal use.
   *
   * @param {Object} msg
   * @private
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
   * @returns {Promise<Boolean>} isFinished
   * @private
   */
  async _isFinished() {

    let waited = 0;
    const maxWait = 10;

    if (this._queue.length === 0 && this._jobs.length > 0) {
      async function sleep(sec) {
        return new Promise(res => setTimeout(res, sec * 1000));
      }
      const start = Date.now();
      while (this._queue.length === 0 && this._jobs.length > 0 && 
             ((Date.now() - start) / 1000) <= maxWait) {
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

  async _worker() {
    if (this.resultCount <= 0 || this.siteCount <= 0 || ((Date.now() - this._startTime) / 1000) >= this.timeLimit) {
      return;
    }
    const focusURL = this._queue.pop();

    // check if visitied before
    if (this._seen.has(focusURL)) {
      this._logInfo(`skipping: ${focusURL} (already visitied)`);
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


      this.siteCount--;
      await Promise.all(jobs);

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
        this._jobs = []
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
};
