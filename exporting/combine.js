/**
 * @param {...function(String, String, String)} exports
 * @returns {function(...function(String, String, String)): function(String, String, String): Promise<void>}
 */
module.exports = (...exports) => async (url, sel, txt) => {
  // eslint-disable-next-line no-await-in-loop
  for (const p of exports.map((e) => e(url, sel, txt))) await p;
};
