const { logger } = require('./Logger');

module.exports = class RabbitMQ {

  config;
  client;

  constructor(config) {
    this.config = config;
  }

  async init() {
    this.client = require("foo-foo-mq");
    return this.client.configure(this.config);
  }

  async shutdown() {
    logger.info('RabbitMQ Shutdown');
    return this.client.shutdown();
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

    if (Object.prototype.toString.call(handler) === '[object AsyncFunction]') {
      logger.info('RabbitMQ Consumer Bind An AsyncFunction Handler');
      const asyncHandler = handler;
      options.autoNack = true;
      handler = function (message) {
        return asyncHandler(message).catch(function(err) {
          logger.error('RabbitMQ Consumer AsyncFunction Handler Catch Error:', err);
          message.nack();
        });
      }
    }

    // https://github.com/Foo-Foo-MQ/foo-foo-mq/blob/master/docs/receiving.md
    // rabbot.handle( options, handler )
    return this.client.handle(options, handler);
  }
}
