const gracefulExit = require('graceful-process');
const Rabbitmq = require('./RabbitMQ');
const { logger } = require('./Logger');
const { isObject } = require('./util');
const {
  rabbitmqCfg,
  qiniuCfg,
  bxhServerCfg,
  puppeteerCfg,
  workerIntervalReport,
} = require('./config/index');

const rabbitmq = new Rabbitmq({
  connection: rabbitmqCfg.connection,
  queues: rabbitmqCfg.queues,
});
let qiniu = undefined;
let bxhServer = undefined;

let processExitTimer = undefined;

let queueName = '';

let isInit = false;
let isBindHandle = false;
global.isBusy = false;
global.isTimeToRetire = false;
global.timeToRetire = exitHandle;

process.rolePlay = 'Worker';

// 捕获未知异常
process.on('uncaughtException', function(err) {
  logger.error('!!!!!!!!!!!!>>>> Process UncaughtException <<<<!!!!!!!!!!!!!');
  global.isBusy = false;
  if (processExitTimer) {
    clearTimeout(processExitTimer);
  }
  processExitTimer = setTimeout(function(){
    global.isBusy = false;
    global.isTimeToRetire = true;
    exitHandle(err);
  }, 1000 * 60 * 5);
  exitHandle(err);
});

// 收到进程退出信号
process.on('SIGTERM', exitHandle);

// 收到父进程发来的消息
process.on('message', processMessageHandle);


function processMessageHandle(msg, handle) {
  return (async (msg, handle) => {
    if (!isObject(msg)) return logger.warn('收到未知类型消息', msg);

    if (msg.type === 'runtimeInfo') {
      queueName = msg.queueName;
      return;
    }

    if (msg.type === 'bindMsgHandle') {
      if (!isBindHandle) {
        if (!isInit) await init();
        const consumeHandle = require(msg.handle);
        rabbitmq.subscribe(msg.queueName, consumeHandle({
          bxhServer,
          qiniu,
          puppeteerCfg
        }));
        isBindHandle = true;
      }
      logger.info('创建消费者成功', msg);
      return;
    }

    if (msg.type === 'timeToRetire') {
      logger.info('该休息了~', msg);
      global.isTimeToRetire = true;
      if (!global.isBusy) await exitHandle();
      return;
    }

    logger.warn('收到未定义类型消息', msg);
  })(msg, handle).catch(err => {
    exitHandle(err);
  });
}

function exitHandle(err) {
  return (async err => {
    if (err) logger.error(err.stack || err);
    if (global.isBusy) {
      global.isTimeToRetire = true;
      logger.info('Worker繁忙，延迟退出');
      return;
    }
    if (rabbitmq && rabbitmq.client) {
      await rabbitmq.shutdown();
    }

    process.send({
      type: 'workerExit',
      workerId: process.pid,
      queueName: queueName,
    });
    logger.info('Worker exit');
    process.exit();
  })(err).catch(err => {
    logger.error('进程退出异常', err.stack || err)
  });
}


async function init() {
  if (!rabbitmq.client) {
    await rabbitmq.init();
  }

  if (!bxhServer) {
    bxhServer = new BxhServer(bxhServerCfg);
  }

  if (!qiniu) {
    qiniu = new Qiniu(qiniuCfg);
  }

  isInit = true;
}


function reportProcessInfo() {
  const beginHrTime = process.hrtime();
  let prevHrTime = process.hrtime();
  let prevCpu = process.cpuUsage();
  return function() {
    const cpuTotal = process.cpuUsage();
    process.send({
      type: 'reportProcessInfo',
      pid: process.pid,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(prevCpu),
      cpuTotal,
      hrtime: process.hrtime(prevHrTime),
      hrtimeTotal: process.hrtime(beginHrTime),
      queueName: queueName,
      isBusy: global.isBusy,
      isBindHandle: global.isBindHandle,
    });
    prevCpu = cpuTotal;
    prevHrTime = process.hrtime();
  }
}
setInterval(reportProcessInfo(), workerIntervalReport);


gracefulExit({
  logger: console,
  label: 'app_worker',
});
