const gracefulExit = require('graceful-process');
const Rabbit = require('./rabbit');
const { logger } = require('./logger');
const { isObject } = require('./util');
const { Message, MSG_TYPES } = require('./message');

process.role = 'worker';
let rabbitInstance = null;
global.isTimeToRetire = false;
global.isBusy = false;

// recevice message from master process
process.on('message', processMessageHandle);

// stop worker
process.on('SIGTERM', async function(sig) {
  if (rabbitInstance) {
    try {
      await rabbitInstance.gracefulShutdown();
    } catch (err) {
      logger.error('gracefully disconnect from RabbitMQ error:', err);
    }
  }
  process.exit(0);
});

process.on('SIGINT', async function(sig) {
  // do nothing...
});

process.once('disconnect', async () => {
  // wait a loop for SIGTERM event happen
  setImmediate( () => {
    // if disconnect event emit, maybe master exit in accident
    logger.error('receive disconnect event on child_process fork mode, exiting with code:110');
    rabbitInstance.gracefulShutdown().catch((err) => {
      logger.error('gracefully disconnect from RabbitMQ error:', err);
      process.exit(110);
    });
  });
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
    process.title = `${msg.appName}-worker`
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

// as we all know, can't do async operations here.
function exitHandle(code) {
  process.send({
    type: MSG_TYPES.WORKER_EXIT,
    pid: process.pid,
  });
}




