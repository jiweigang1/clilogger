#!/usr/bin/env node
import { execSync } from "child_process";
import os   from 'os';
import path from 'path';
import { pathToFileURL, fileURLToPath } from "node:url";

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

/**
 * 获取命名管道路径
 * @returns 
 */
export function getPipePath(){
    const PIPE_NAME = 'jsonrpc';
    let PIPE_PATH;
    if (process.platform === 'win32') {
        // Windows 命名管道
        PIPE_PATH = `\\\\.\\pipe\\${PIPE_NAME}`;
    } else {
        // macOS / Linux 使用 Unix 域套接字路径
        PIPE_PATH = path.join(os.tmpdir(), PIPE_NAME + '.sock');
    }
    console.log('Pipe path:', PIPE_PATH);
    return PIPE_PATH;
}
