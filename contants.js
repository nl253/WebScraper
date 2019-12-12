module.exports = {
  SEC: 1000,
  // eslint-disable-next-line optimize-regex/optimize-regex
  REGEX_URI: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/,
  REGEX_SANITISE_NL: /\n{2,}/g,
  REGEX_SANITISE: /\s{2,}\n+|\n{2,}\s+/g,
  REGEX_SANITISE_WS: /\s{2,}/g,
  LoggingLevel: {
    Info: 'info',
    Error: 'error',
  }
};
