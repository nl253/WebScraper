/**
 * @param {...function(String, String, String)} exports
 * @returns {function(String, String, String): Promise<void>}
 */
module.exports = (...exports) => async (uri, selector, text) => {
  for (const j of exports.map((e) => e(uri, selector, text))) {
    // eslint-disable-next-line no-await-in-loop
    await j;
  }
};
