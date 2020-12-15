const gracefulExit = require('graceful-process');
const Rabbit = require('./rabbit');
const { logger } = require('./logger');
const { isObject } = require('./util');
const { Message, MSG_TYPES } = require('./message');

process.title = 'worker';
let rabbitInstance = null;
global.isTimeToRetire = false;
global.isBusy = false;

// recevice message from master process
process.on('message', processMessageHandle);

// stop worker
process.on('SIGTERM', async function(sig) {
  process.exit(0);
});

process.on('SIGINT', async function(sig) {
  // do nothing...
});

process.on('uncaughtException', async function(err) {
  logger.error(err);
  process.exit(2);
});

process.on('exit', exitHandle);

process.on('unhandledRejection', function (err) {
  logger.error(err.stack);
})

async function processMessageHandle(msg, handle) {
  if (!isObject(msg)) return logger.warn('unknown msg', msg);
  if (msg.type === MSG_TYPES.BIND_MSG_HANDLE) {
    try {
      const rabbitmqCfg = msg.rabbitConf;
      rabbitInstance = new Rabbit({
        connection: rabbitmqCfg.connection,
        exchanges: rabbitmqCfg.exchanges,
        queues: rabbitmqCfg.queues,
        bindings: rabbitmqCfg.bindings,
      });
      await rabbitInstance.init();
      const consumeHandle = require(msg.workerFile);
      rabbitInstance.subscribe(msg.queueName, consumeHandle);
      logger.info(`create rabbitmq consumer successfully: queue[${msg.queueName}]`);
    } catch (err) {
      logger.error('connecting to RabbitMQ failed:', err);
    }
  }
}

async function exitHandle(code) {
  try {
    if (rabbitInstance) {
      await rabbitInstance.shutdown();
    }
  } catch (err) {
    logger.error('disconnect from RabbitMQ error:', err)
  }
  process.send({
    type: MSG_TYPES.WORKER_EXIT,
    pid: process.pid,
  });
}




