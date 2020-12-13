const { YYYY_MM_DD_hh_mm_ss, isObject, isArray } = require('./util');

class Logger {
  logger;

  constructor(logger){
    this.logger = logger || console;
  }

  getText() {
    const now = new Date();
    const args = [...arguments].map(arg => {
      if (isArray(arg)) return JSON.stringify(arg);
      if (isObject(arg)) return JSON.stringify(arg);
      return arg;
    });
    return `[${YYYY_MM_DD_hh_mm_ss(now)}] [${process.rolePlay}] [${process.pid}] ${[...args].join(' ')}`;
  }

  debug() {
    this.logger.debug(this.getText(...arguments));
  }

  info() {
    this.logger.info(this.getText(...arguments));
  }

  warn() {
    this.logger.warn(this.getText(...arguments));
  }

  error() {
    this.logger.error(this.getText(...arguments));
  }
}

exports.logger = new Logger();
exports.Logger = Logger;