/**
 * @param {String} [format]
 * @returns {function(String): function(String, String, String): Promise<void>}
 */
// eslint-disable-next-line require-await
module.exports = (format = '%s %s %s\n') => async (url, sel, txt) => console.log(format, url, sel, txt);
