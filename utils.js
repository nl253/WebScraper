/**
 * Sleeps for sec seconds.
 *
 * @private
 * @param {number} sec
 * @returns {Promise<void>}
 */
const sleep = (sec) => new Promise((resolve, reject) => setTimeout(resolve, sec * SEC));

module.exports = { sleep };
