const { logger } = require('./logger');
const { isAsyncFunction } = require('./util');

module.exports = class Rabbit {
  constructor(config) {
    this._config = config;
  }

  async init() {
    this._client = require("foo-foo-mq");
    return this._client.configure(this._config);
  }

  async shutdown() {
    logger.info('disconnect from RabbitMQ');
    return this._client.shutdown();
  }

  /**
   * 订阅
   *
   * @param {string|object} options
   * optionsObject :{
   *     queue: "*", // only handle messages from the queue with this name
   *     type: "#", // handle messages with this type name or pattern
   *     autoNack: true, // automatically handle exceptions thrown in this handler
   *     context: null, // control what `this` is when invoking the handler
   *     handler: null // allows you to just pass the handle function as an option property ... because why not?
   *   }
   * @param {function} handler
   */
  subscribe(options, handler) {
    if (typeof options === "string") {
      const queueName = options;
      options = {
        queue: queueName,
        type: "#",
        autoNack: true,
        context: null,
        handler: null,
      };
    }

    if (isAsyncFunction(handler)) {
      const asyncHandler = handler;
      options.autoNack = true;
      handler = function (message) {
        if (global.isTimeToRetire) {
          return;
        }
        global.isBusy = true;
        return asyncHandler(message).catch(function(err) {
          logger.error('RabbitMQ consumer asyncFunction handler catch error:', err);
          message.nack();
        }).finally(() => {
          global.isBusy = false;
        });
      }
    }

    // https://github.com/Foo-Foo-MQ/foo-foo-mq/blob/master/docs/receiving.md
    let rhandler = this._client.handle(options, handler);
    rhandler.catch(function( err, msg) {
      msg.nack();
    });
  }
}
