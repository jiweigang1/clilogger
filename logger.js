import os from 'os';
import pino from 'pino';
import fs from 'fs';
import {createStream} from 'rotating-file-stream';
import {fileURLToPath } from 'url';
import path from 'path';

//日志打印在用户目录下面
//const __filename = fileURLToPath(import.meta.url);
let homedir = os.homedir();
//在用户目录下创建配置信息和日志输出
let   logDir = path.join(homedir, '.clilogger','logs');

//如果日志目录不存在进行创建
if (!fs.existsSync(logDir)) {
     fs.mkdirSync(logDir, { recursive: true });
}

console.log('clilogger log Directory:', logDir);

let timestamp = Date.now();

// 创建一个 rotating-file-stream 实例
/*
const stream = createStream(`api-full-${timestamp}.log`, {
  size: "10M", // 每个日志文件的最大大小
  interval: "1d", // 每天轮转一次
  compress: "gzip", // 压缩旧日志文件
  path: logDir, // 日志文件存放路径
});
*/
/*
const stream = pino.destination({
  dest: `${logDir}/api-full-${timestamp}.log`, // 文件路径
  sync: false, //使用同步写入
});
*/
const fd = fs.openSync(`${logDir}/api-full-${timestamp}.log`, 'a');

const stream = {
  write: (str) => {
    // 每条日志：writeSync -> fsyncSync
    fs.writeSync(fd, str);
    fs.fsyncSync(fd);
  }
};

// 创建 Pino 记录器，并将流作为日志输出目标
const apiFullLogger = pino({
    level: process.env.LOG_LEVEL || 'debug', // 允许通过环境变量控制
    base: null,                              // 去掉 pid 和 hostname
    timestamp: () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      return `,"time":"${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}"`;
    },
    formatters: {
      level(label) {
        return { level: label }; // level 数字改为字符串枚举值
      },
    }
},stream);
/** 
// 创建一个 rotating-file-stream 实例
const streamSimple = createStream(`api-simple-${timestamp}.log`, {
  size: "10M", // 每个日志文件的最大大小
  interval: "1d", // 每天轮转一次
  compress: "gzip", // 压缩旧日志文件
  path: logDir, // 日志文件存放路径
});
**/

const fdsimple = fs.openSync(`${logDir}/api-simple-${timestamp}.log`, 'a');

const streamSimple = {
  write: (str) => {
    // 每条日志：writeSync -> fsyncSync
    //fs.writeSync(fdsimple, str.replace(/\\n/g, '\n'));
    fs.writeSync(fdsimple, str);
    fs.fsyncSync(fdsimple);
  }
};

// 创建 Pino 记录器，并将流作为日志输出目标
export const apiSimpleLogger = pino({
    level: process.env.LOG_LEVEL || 'debug', // 允许通过环境变量控制
    base: null,                              // 去掉 pid 和 hostname
    timestamp: () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      return `,"time":"${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}"`;
    },
    formatters: {
      level(label) {
        return { level: label }; // level 数字改为字符串枚举值
      },
    }
},streamSimple);



export default apiFullLogger;
