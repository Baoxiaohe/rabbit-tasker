exports.getType = function (obj) {
  return Object.prototype.toString.call(obj)
}

exports.isFunction = function(functionName) {
  return exports.getType(functionName) === '[object Function]';
}

exports.isAsyncFunction = function(functionName) {
  return exports.getType(functionName) === '[object AsyncFunction]';
}

exports.isObject = function(obj) {
  return exports.getType(obj) === '[object Object]';
}


exports.isArray = function(arr) {
  return exports.getType(arr) === '[object Array]';
}

exports.isDate = function(date) {
  return exports.getType(date) === '[object Date]';
}

exports.isString = function(date) {
  return exports.getType(date) === '[object String]';
}


exports.YYYY_MM_DD_hh_mm_ss = function(date) {
  if (!date) date = new Date();
  if (!exports.isDate(date)) date = new Date(date);
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const ri = ('0' + date.getDate()).slice(-2);
  const hour = ('0' + date.getHours()).slice(-2);
  const minute = ('0' + date.getMinutes()).slice(-2);
  const second = ('0' + date.getSeconds()).slice(-2);
  return `${year}-${month}-${ri} ${hour}:${minute}:${second}`;
}