const ChildProcess = require('child_process');
const path = require('path');
const { isFunction, isAsyncFunction } = require('./util');
const { logger } = require('./logger');
const { Message, MSG_TYPES } = require('./message');

process.title = 'master';
const workerPool = new Map();
let rabbitConf = null;
let positiveExit = false

process.on('uncaughtException', function(err) {
  logger.error('master occured error', err.stack);
});

process.on('SIGINT', masterExit);
process.on('SIGTERM', masterExit);

process.on('unhandledRejection', function (err) {
  logger.error(err.stack);
});

process.on('message', processMessageHandle);

async function processMessageHandle(msg, handle) {
  if (!isObject(msg)) return logger.warn('unknown msg', msg);
  if (msg.type === MSG_TYPES.WORKER_EXIT) {
    const pid = msg.pid;
    if (!positiveExit) {
      // exit with exception
      const childSettings = workerPool.get(pid);
      startWorker(childSettings.queueName, childSettings.workerFile);
    }
    workerPool.delete(pid);
  }
}

async function masterExit() {
  positiveExit = true;
  for (const [pid, worker] of workerPool) {
    stopWorker(pid);
  }
  setInterval(() => {
    if (workerPool.size <= 0) {
      process.exit();
    }
  }, 500)
}

/**
 * start the worker
 * @param {string} queueName
 * @param {string} workerFile
 */
function startWorker(queueName, workerFile) {
  const childProcess = ChildProcess.fork(path.join(__dirname, './worker.js'), {detached: true}); // default SIGINT will send to process group.
  logger.info(`fork worker successfully: queue[${queueName}]`);
  childProcess.send(new Message(rabbitConf, queueName, workerFile, MSG_TYPES.BIND_MSG_HANDLE));
  // childProcess.on('message', childProcessHandleMsg);
  workerPool.set(childProcess.pid, {
    pid: childProcess.pid,
    childProcess,
    queueName,
    workerFile,
  });
}

function stopWorker(workerId) {
  const worker = workerPool.get(workerId);
  const childProcess = worker.childProcess;
  logger.info(`stop worker ${childProcess.pid}`);
  childProcess.kill();
}

/**
 * batch start workers
 * @param {string} qName
 * @param {string} workerFile
 * @param {number} workers
 */
function startBatchWorkers(qName, workerFile, workers) {
  for(let i = 0; i < workers; i++) {
    startWorker(qName, workerFile);
  }
}

function initWorkerPool(queuesConf) {
  for (const qName in queuesConf) {
    if (!queuesConf.hasOwnProperty(qName)) continue;
    const qCfg = queuesConf[qName];
    qCfg.workers = parseInt(qCfg.workers);
    if (!qCfg.workers || qCfg.workers <= 0) {
      throw Error('workers must greater than 0.')
    }
    const consumeHandle = require(qCfg.workerFile);
    if (!isFunction(consumeHandle) && !isAsyncFunction(consumeHandle)) {
      throw new TypeError(`handle must be function type.`);
    }
    startBatchWorkers(qName, qCfg.workerFile, qCfg.workers);
  }
}

/**
 *
 * @param {Object} rabbitConfigure just need in rabbit.configure(*) https://github.com/Foo-Foo-MQ/foo-foo-mq
 * @param {Object} queuesConf
 */
function start(rabbitConfigure, queuesConf) {
  if (!rabbitConfigure || !queuesConf) {
    throw new Error('param is needed.')
  }
  rabbitConf = rabbitConfigure
  initWorkerPool(queuesConf)
}

module.exports.start = start;

