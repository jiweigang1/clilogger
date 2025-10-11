#!/usr/bin/env node
import { execSync } from "child_process";
import os   from 'os';
import path from 'path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from "node:url";
import LogManager from "./logger-manager.js";
const logger = LogManager.getSystemLogger();

function getGlobalNpmPath() {
    try {
    const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    console.log("全局模块路径:", npmRoot);
    return npmRoot;
    } catch (err) {
       console.error("获取 npm root -g 失败:", err.message);
    }
}

//mcp_oauth_tokens.js

export function getMcpOauthTokensPath(){
     let home = os.homedir();
    return path.join(home,'.clilogger',"mcp_oauth_tokens.js");
}

export function getCloggerFileURL(){
    return pathToFileURL(path.join(getGlobalNpmPath(),'clilogger',"clogger.js"));
}
//C:\Users\gang.ji\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code
export function getClaudePath(){
     return path.join(getGlobalNpmPath(),'@anthropic-ai',"claude-code","cli.js");
}
//C:\Users\gang.ji\AppData\Roaming\npm\node_modules\@openai\codex\bin\codex.js
export function getCodexPath(){
     return path.join(getGlobalNpmPath(),'@openai',"codex","bin","codex.js");
}


/**
 * 代理 body 对象
 * @param {*} body 
 * @returns 
 
function proxyBody(body){
     // 初始化 readers 的辅助函数
      function initReaders(target) {
          if(!target["_readers"]){
              const [toClient, toLog] = target.tee();
              target["_readers"] = {
                  toClient,
                  toLog
              }
          }
      }
        const handler = {
            get(target, prop, receiver) {
                console.log(prop);
                const value = Reflect.get(target, prop, receiver);
                if(prop == "getReader"){
                    return () =>{
                        initReaders(target);
                        return target["_readers"].toClient.getReader();
                    };
                }else if(prop == "getReaderLog"){
                    return() =>{
                        initReaders(target);
                        return target["_readers"].toLog.getReader();
                    };
                }else if(prop == "readAllLog"){
                    return async () => {
                        //保证被初始化
                        initReaders(target);
                        let reader = target["_readers"].toLog.getReader();
                        const decoder = new TextDecoder('utf-8');
                        let buffer = '';
                        while (true) {
                            const { done, value } = await reader.read();
                            if(value){
                                buffer += decoder.decode(value, { stream: true });
                            }
                            if (done) {
                                break;
                            }
                        }
                        //释放锁
                        reader.releaseLock();
                        return buffer;
                    };
                // 当前 body 自身是不会被锁的，只能锁  tee  流 
                }else if(prop == "locked"){
                    return false
                }else if(prop ){

                }


                return value;
            },
            set(obj, prop, value) {
                if(prop == "locked"){
                    return true;
                }
                obj[prop] = value;
                return true; // 必须返回 true
            }
        };
       return new Proxy(body, handler);
}
*/
/**
 * 
 * @param {*} response 
 * @returns 

// 代理 Response 请求
export function proxyResponse(response){
      const target = { name: "Alice", age: 25 };
        const handler = {
            get(obj, prop) {
                //console.log(`读取属�? ${prop}`);
                if(prop == "body"){
                     // body 可能为空
                     if(!obj["body"]){
                        return ;
                     }
                     if(!obj["_body"]){
                         obj["_body"] = proxyBody(obj["body"]); 
                     }
                     return obj["_body"];   
                }
                return obj[prop];
            },
            set(obj, prop, value) {
                //console.log(`设置属�? ${prop} = ${value}`);
                obj[prop] = value;
                return true; // 必须返回 true
            }
        };
       return new Proxy(response, handler);
}

 */
/**
 * 
 */
export function getOptions(){
    const args = process.argv.slice(2);
    const options = {};
    args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, value = true] = arg.slice(2).split('=');
        options[key] = value;
    }
    });
  return options;
};


export function getParentPidSync(pid) {
  if (process.platform === 'linux') {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      // /proc/<pid>/stat: pid (comm) state ppid ...
      // 注意 comm 里有括号，按空格拆分前先把括号段去掉
      const rightParen = stat.indexOf(')'); // 找到进程名右括号
      const after = stat.slice(rightParen + 2); // 跳过 ") "
      const fields = after.split(' ');
      const ppid = Number(fields[1]); // state 后面紧跟就是 ppid
      return Number.isFinite(ppid) ? ppid : null;
    } catch {
      // 回退
    }
  }

  if (process.platform === 'darwin' || process.platform === 'freebsd' || process.platform === 'openbsd') {
    try {
      const stdout = execSync(`ps -o ppid= -p ${pid}`, { encoding: 'utf8' }).trim();
      return stdout ? Number(stdout) : null;
    } catch {
      // 回退
    }
  }

  if (process.platform === 'win32') {
    // 用 PowerShell + CIM，并强制 UTF-8 输出，避免编码问题与 wmic 弃用问题
    try {
      const cmd = [
        'powershell',
        '-NoProfile',
        '-Command',
        // 强制 UTF-8 输出；有些系统默认不是 UTF-8
        "$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();",
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").ParentProcessId`
      ].join(' ');
      const stdout = execSync(cmd, { encoding: 'utf8' }).trim();
      const n = Number(stdout);
      return Number.isFinite(n) ? n : null;
    } catch {
      // 最后再尝试 wmic（若存在）
      try {
        const stdout = execSync(
          `wmic process where (ProcessId=${pid}) get ParentProcessId /format:list`,
          { encoding: 'utf8' }
        );
        const m = stdout.match(/ParentProcessId=(\d+)/i);
        return m ? Number(m[1]) : null;
      } catch {}
    }
  }

  // 通用兜底（适用于大多数 Unix）
  try {
    const stdout = execSync(`ps -o ppid= -p ${pid}`, { encoding: 'utf8' }).trim();
    return stdout ? Number(stdout) : null;
  } catch {
    return null;
  }
}

//export const PIPE_NAME = Date.now() + 'jsonrpc';
/**
 * 获取命名管道路径
 * Unix domain socket 通信
 * @returns 
 */
export function getPipePath(){
    
    const PIPE_NAME = process.env.PIPE_PATH_PRE?  process.env.PIPE_PATH_PRE + 'jsonrpc' :  'jsonrpc';

    let PIPE_PATH;
    if (process.platform === 'win32') {
        // Windows 命名管道
        PIPE_PATH = `\\\\.\\pipe\\${PIPE_NAME}`;
    } else {
        // macOS / Linux 使用 Unix 域套接字路径
        // macOS os.tmpdir() 有时候会返回两种不同的路径 
        // /var/folders/82/0y73zsn14ls4cp6g660xb9nm0000gn/T
        // /tmp/
        //PIPE_PATH = path.join(os.tmpdir(), PIPE_NAME + '.sock');
        
       //使用写死的方案
       PIPE_PATH = path.join('/tmp', PIPE_NAME + '.sock');
    }
    console.log('Pipe path:', PIPE_PATH);
    return PIPE_PATH;
}
