import pino from 'pino';
import {createStream} from 'rotating-file-stream';
import { fileURLToPath } from 'url';
import path from 'path';

// 计算日志目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, 'logs');


// 创建一个 rotating-file-stream 实例
const stream = createStream("myapp.log", {
  size: "10M", // 每个日志文件的最大大小
  interval: "1d", // 每天轮转一次
  compress: "gzip", // 压缩旧日志文件
  path: logDir, // 日志文件存放路径
});

// 创建 Pino 记录器，并将流作为日志输出目标
const logger = pino({
    level: process.env.LOG_LEVEL || 'debug', // 允许通过环境变量控制
  },stream);



export default logger;
