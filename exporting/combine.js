/**
 * @param {...ExportFunct} exports
 * @returns {ExportFunct}
 */
const combineExport = (...exports) => async (uri, selector, text) => {
  for (const j of exports.map((e) => e(uri, selector, text))) {
    // eslint-disable-next-line no-await-in-loop
    await j;
  }
};

module.exports = combineExport;
