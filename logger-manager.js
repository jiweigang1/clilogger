import os from 'os';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

class LogManager {
  constructor() {
    this.allLoggers = {};
  }
  __createLogger(cliType , full) {
        //日志打印在用户目录下面
        let homedir = os.homedir();
        //在用户目录下创建配置信息和日志输出
        let   logDir = path.join(homedir, '.clilogger','logs',cliType);

        //如果日志目录不存在进行创建
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        //console.log('clilogger log Directory:', logDir);

        let timestamp = Date.now();

        const fd = full? fs.openSync(`${logDir}/api-full-${timestamp}.log`, 'a') : fs.openSync(`${logDir}/api-simple-${timestamp}.log`, 'a');

        const stream = {
        write: (str) => {
            // 每条日志：writeSync -> fsyncSync
            fs.writeSync(fd, str);
            fs.fsyncSync(fd);
        }
        };

        // 创建 Pino 记录器，并将流作为日志输出目标
        const logger = pino({
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

        return logger;
    
  }
  getSystemLogger(){
    return this.getLogger();
  }
  getLogger(cliType, full=true) {
     if(!this.allLoggers["_system"]){
         this.allLoggers["_system"] = this.__createLogger("system", false);
     }
     if(cliType==null){
        return this.allLoggers["_system"];
     }
     if(!this.allLoggers[cliType]){
        this.allLoggers[cliType] = {
            full:this.__createLogger(cliType, full),
            simple:this.__createLogger(cliType, false),
            system:this.allLoggers["_system"]
        }
     }
     return this.allLoggers[cliType];
  }
}

export default new LogManager();
