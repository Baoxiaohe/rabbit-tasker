## 安装
```
npm install --save rabbit-tasker
```

## 使用
**main.js**
```Javascript
const path = require('path');

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
    { name: 'exchange-test', 
      type: 'direct', 
      autoDelete: true,
      durable: true,
      persistent: true, 
      durable: true, 
    }
  ],
  queues: [
    { name: 'queue-test', autoDelete: true, subscribe: true, durable: true },
  ],
  bindings: [
    { exchange: 'exchange-test', target: 'queue-test', keys: ['test'] }
  ]
};
const taskConf = {
  'queue-test': {
    workerFile: path.resolve('./my_task.js'), // task file path
    workers: 4, // workers number
  }
};
rabbitTasker.start(rabbitConf, taskConf);
```
`rabbitConf` from [here](https://github.com/Foo-Foo-MQ/foo-foo-mq/blob/master/docs/topology.md).


**my_task.js**
```Javascript
module.exports = async (msg) => {
  const body = message.body;
  console.log(`receive msg:`, body);
  console.log(`working...`)
  msg.ack();
}
```


## 本地快速启动RabbitMQ
这里我使用docker安装RabbitMQ：  
**docker-compose.yml**
```yaml
version: "2"
services:
  mq:
    image: rabbitmq:3.7.8-management
    restart: always
    mem_limit: 2g
    hostname: mq1
    volumes:
      - ./mnesia:/var/lib/rabbitmq/mnesia
      - ./log:/var/log/rabbitmq
      - ./rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf
    ports:
      - "55672:15672"
      - "56720:5672"
    environment:
      - CONTAINER_NAME=rabbitMQ
      - RABBITMQ_ERLANG_COOKIE=3t182q3wtj1p9z0kd3tb
```
**rabbitmq.conf**
```
loopback_users.guest = false
listeners.tcp.default = 5672
default_pass = zeWqx4dEuFYnIZve
default_user = test
hipe_compile = false
management.listener.port = 15672
management.listener.ssl = false
```


## 注意
当消息`content_type`为`application/json`时，消息内容为不合法的JSON时（标准JSON使用双引号），消息内部被消费掉，不会传到业务代码层。
