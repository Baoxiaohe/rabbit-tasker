const MSG_TYPES = {
  BIND_MSG_HANDLE: 'bindMsgHandle',
}

class Message {
  /**
   * message class
   * @param {Object} rabbitConf
   * @param {string} queueName
   * @param {string} workerFile
   * @param type
   */
  constructor(rabbitConf, queueName, workerFile, type) {
    this.rabbitConf = rabbitConf;
    this.queueName = queueName;
    this.workerFile = workerFile;
    this.type = type;
  }
}



module.exports.Message = Message;
module.exports.MSG_TYPES = MSG_TYPES;
