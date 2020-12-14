# 使用
**main.js**
```Javascript
const rabbitTasker = require('rabbit-tasker');
const rabbitConf = {
  connection: {
    name: 'default',
    user: 'user',
    pass: 'password',
    host: 'test_server',
    port: 56720,
    vhost: '/',
    replyQueue: false,
    // 心跳检测周期 秒
    heartbeat: 10,
    // 连接超时时间 毫秒
    timeout: 2000,
    // 尝试掉线重连的总时间 秒
    failAfter: 60 * 30,
    // 尝试掉线重连的次数 次
    retryLimit: 100000,
    // 最小时间间隔 毫秒
    waitMin: 1000,
    // 每次尝试的递增值 毫秒
    waitIncrement: 500,
    // 最大时间间隔 毫秒
    waitMax: 3000,
  },
  exchanges: [
    { name: 'exchange-test', type: 'direct', autoDelete: true }
  ],
  queues: [
    { name: 'queue-test', autoDelete: true },
  ],
  bindings: [
    { exchange: 'exchange-test', target: 'queue-test', keys: ['test'] }
  ]
};
const taskConf = {
  'queue-test': {
    workerFile: path.resolve('./my_task.js'),
    workers: 4,
  }
};
rabbitTasker.start(rabbitConf, taskConf);
```
**my_task.js**
```Javascript
module.exports = async (msg) => {
  const body = message.body;
  console.log(`receive msg:`, body);
  console.log(`working...`)
  msg.ack();
}
```