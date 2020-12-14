const ChildProcess = require('child_process');
const path = require('path');
const { rabbitmqConsumer, webServerCfg } = require('./config/index');
const { isFunction, isAsyncFunction, isObject } = require('./util');
const { logger } = require('./Logger');

// workerPool: {
//   'childProcess.pid': { pid: number, process: ChildProcess, ... },
//   'childProcess.pid': { pid: number, process: ChildProcess, ... },
//   'childProcess.pid': { pid: number, process: ChildProcess, ... },
// }
global.workerPool = new Map();

process.rolePlay = 'Master';

// 捕获未知异常
process.on('uncaughtException', function(err){
  logger.error(err.stack || err);

  // !!!!! 父进程异常退出，子进程会变成孤儿进程，一定要手动退出
  for (const worker of global.workerPool) {
    stopWorker(worker[0]);
  }

  process.exit();
});


function initWorkerPool() {
  for (const qName in rabbitmqConsumer) {
    if (!rabbitmqConsumer.hasOwnProperty(qName)) continue;
    const qCfg = rabbitmqConsumer[qName];
    qCfg.count = parseInt(qCfg.count);
    if (isNaN(qCfg.count)) throw new TypeError(`rabbitmqConsumer.${qName}.count 有误`);
    if (qCfg.count <= 0) {
      throw new TypeError(`rabbitmqConsumer.${qName}.count 不能 <= 0`);
    }
    const consumeHandle = require(qCfg.handle);
    if (!isFunction(consumeHandle) && !isAsyncFunction(consumeHandle)) {
      throw new TypeError(`rabbitmqConsumer.${qName}.handle 有误。必须为function`);
    }

    for(let i = 1; i <= qCfg.count; i++) {
      startWorker(qName, qCfg.handle);
    }
  }

  setTimeout(function() {
    for (const kv of global.workerPool) {
      const workerId = kv[0];
      const worker = kv[1];
      if (!worker.activeTime) worker.activeTime = Date.now();
      if (Date.now() - worker.activeTime > 1000 * 60 * 3) {
        global.workerPool.delete(workerId);
        startWorker(worker.queueName, worker.msgHandle);
      }
    }
  }, 1000 * 60);
}

function startWorker(queueName, msgHandle) {
  const childProcess = ChildProcess.fork(path.join(__dirname, './worker.js'));
  logger.info('fork worker successfully', `${queueName}-${childProcess.pid}`);
  childProcess.send({
    type: 'runtimeInfo',
    queueName,
  })
  childProcess.send({
    type: 'bindMsgHandle',
    queueName,
    handle: msgHandle,
  });
  childProcess.on('message', childProcessHandleMsg);
  global.workerPool.set(childProcess.pid, {
    pid: childProcess.pid,
    process: childProcess,
    queueName,
    msgHandle,
  });
}
global.startWorker = startWorker;

function stopWorker(workerId) {
  const worker = global.workerPool.get(workerId);
  if (!worker) return logger.error('worker id error.', workerId);
  const childProcess = worker.process;
  if (!childProcess) return logger.error('get childProcess failed.', worker);
  logger.info(`stop worker[pid ${childProcess.pid}]`);
  childProcess.kill();
}
global.stopWorker = stopWorker;

// 收到子进程发来的消息
function childProcessHandleMsg(message) {
  if (!isObject(message)) return logger.warn('unknown error', message);
  if (message.type === 'workerExit') {
    const { workerId, queueName } = message;
    if (!workerId || !queueName) {
      logger.error('illegal message', message);
      return;
    }
    global.workerPool.delete(workerId);
    logger.info(`remove worker queue: ${queueName} workerId: ${workerId}`);

    let workerCount = 0;
    for (const kv of global.workerPool) {
      const worker = kv[1];
      if (worker && worker.queueName && worker.queueName === queueName) {
        workerCount++;
      }
    }
    const qCfg = rabbitmqConsumer[queueName];
    qCfg.count = parseInt(qCfg.count);
    logger.info(`当前Worker Queue: ${queueName} Count: ${workerCount} Config: ${qCfg.count}`);
    const needAdd = qCfg.count - workerCount;
    if (needAdd > 0) {
      for(let i = 1; i <= needAdd; i++) {
        startWorker(queueName, qCfg.handle);
      }
    }

    return;
  }

  if (message.type === 'reportProcessInfo') {
    // obj2的值赋给obj1，返回obj1
    function extend(obj1={}, obj2={}) {
      for (const key in obj2) {
        if (obj2.hasOwnProperty(key)) {
          obj1[key] = obj2[key];
        }
      }
      obj1.activeTime = Date.now();
      return obj1;
    }
    extend(global.workerPool.get(message.pid), message);
    return;
  }

  logger.warn('receive undefined message', message);
}


function main() {
  initWorkerPool();
  if (webServerCfg.enable) {
    logger.info('开启WebServer')
    require('./web/websocketServer');
  }
}

try {
  main();
} catch (error) {
  throw error;
}
