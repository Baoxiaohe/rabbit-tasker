const gracefulExit = require('graceful-process');
const Rabbit = require('./rabbit');
const { logger } = require('./logger');
const { isObject } = require('./util');
const { Message, MSG_TYPES } = require('./message');

process.title = 'worker'
let rabbitInstance = null;
global.isTimeToRetire = false;
global.isBusy = false;

// 收到父进程发来的消息
process.on('message', processMessageHandle);

process.on('SIGTERM', exitHandle);

process.on('uncaughtException', function(err) {
  logger.error(err);
})

function processMessageHandle(msg, handle) {
  if (!isObject(msg)) return logger.warn('unknown msg', msg);
  if (msg.type === MSG_TYPES.BIND_MSG_HANDLE) {
    const rabbitmqCfg = msg.rabbitConf;
    rabbitInstance = new Rabbit({
      connection: rabbitmqCfg.connection,
      exchanges: rabbitmqCfg.exchanges,
      queues: rabbitmqCfg.queues,
      bindings: rabbitmqCfg.bindings,
    });
    rabbitInstance.init().catch((err) => {
      logger.error('connecting to RabbitMQ failed:', err);
    }).then(() => {
      const consumeHandle = require(msg.workerFile);
      rabbitInstance.subscribe(msg.queueName, consumeHandle);
      logger.info(`create rabbitmq consumer successfully: queue[${msg.queueName}]`);
    })
  }
}

function exitHandle(err) {
  process.exit();
}




