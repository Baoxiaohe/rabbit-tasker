const ChildProcess = require('child_process');
const path = require('path');
const { isFunction, isAsyncFunction } = require('./util');
const { logger } = require('./logger');
const { Message, MSG_TYPES } = require('./message');

process.title = 'master';
const workerPool = new Map();
let rabbitConf = null;

process.on('uncaughtException', function(err) {
  logger.error('master occured error', err.stack);
});

/**
 * start the worker
 * @param {string} queueName
 * @param {string} workerFile
 */
function startWorker(queueName, workerFile) {
  const childProcess = ChildProcess.fork(path.join(__dirname, './worker.js'));
  logger.info(`fork worker successfully for queue ${queueName}`);
  childProcess.send(new Message(rabbitConf, queueName, workerFile, MSG_TYPES.BIND_MSG_HANDLE));
  // childProcess.on('message', childProcessHandleMsg);
  workerPool.set(childProcess.pid, {
    pid: childProcess.pid,
    childProcess,
    queueName,
    workerFile,
  });
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

