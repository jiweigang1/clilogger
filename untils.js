#!/usr/bin/env node
import { execSync } from "child_process";
import psList from 'ps-list';
import os   from 'os';
import path from 'path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from "node:url";
import psTree from 'ps-tree';
import LogManager from "./logger-manager.js";
import { get } from "node:http";
const logger = LogManager.getSystemLogger();

function getGlobalNpmPath() {
    try {
    const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    logger.debug("全局模块路径:", npmRoot);
    return npmRoot;
    } catch (err) {
       logger.error("获取 npm root -g 失败:", err.message);
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
                logger.debug(prop);
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



export function psTreeAsync(pid) {
  return new Promise((resolve, reject) => {
    psTree(pid, (err, children) => {
      if (err) reject(err);
      else resolve(children);
    });
  });
}


global.PIPE_PATH_PRE = null;
/**
 * 获取命名管道路径
 * Unix domain socket 通信
 * @returns 
 */
export async function getPipePath(){
    
    let PIPE_NAME ;    
    if(process.env.PIPE_PATH_PRE){
        PIPE_NAME = process.env.PIPE_PATH_PRE + 'jsonrpc';
    }else{
        if(global.PIPE_PATH_PRE){
            PIPE_NAME = global.PIPE_PATH_PRE + 'jsonrpc';
        }else{
            let  node = await findFirstProcess(process.pid);
            if(node){
                PIPE_NAME = node.pid + 'jsonrpc';
                global.PIPE_PATH_PRE = node.pid+"";
            }else{
                PIPE_NAME = 'jsonrpc';
            }
        }
        //使用第一个 node进程 id
       
    }

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
    logger.debug('Pipe path:', PIPE_PATH);
    return PIPE_PATH;
}
/**
 * 获取系统的所有进程的祖先
 * @param {} pid 
 * @returns 
 */
async function getProcessAncestors(pid) {
  const processes = await psList();
  const map = new Map(processes.map(p => [p.pid, p])); // 建立 pid -> 进程映射
  const mapAll = new Map(); 
  const ancestors = [];
  ancestors.push(map.get(pid));
  let current = map.get(pid);
  while (current && current.ppid && current.ppid !== 0) {
    //已经存在返回，防止循环
    if(mapAll.get(current.ppid)){
        break;
    } 
    const parent = map.get(current.ppid);
    logger.debug(`当前进程: ${JSON.stringify(current)}, 父进程: ${JSON.stringify(parent)}`);

    if (!parent){ 
        break;
    }
    if(current.pid == parent.pid){
        break;
    }
    mapAll.set(parent.pid, parent);
    ancestors.push(parent);
    current = parent;
  }
  return ancestors;
}

async function findFirstProcess(pid) {
   let  process = [...(await getProcessAncestors(pid))].reverse()
   for(let p of process){
     if(p.name === "node.exe" ||  p.name === "node"){
        return p;
     }
   }
   return null;
}

//console.log(await findFirstProcess(process.pid));