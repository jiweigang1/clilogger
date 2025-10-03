#!/usr/bin/env node
import { execSync } from "child_process";
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
 */
function proxyBody(body){
        const handler = {
            get(target, prop, receiver) {
                const value = Reflect.get(target, prop, receiver);
                if(prop == "getReader"){
                    return () =>{
                        if(!target["_readers"]){
                            const [toClient, toLog] = target.tee();
                            target["_readers"] = {
                                toClient,
                                toLog
                            }
                        }
                        return target["_readers"].toClient.getReader();
                    };
                }else if(prop == "getReaderLog"){
                    return() =>{
                        if(!target["_readers"]){
                            const [toClient, toLog] = target.tee();
                            target["_readers"] = {
                                toClient,
                                toLog
                            }
                        }
                        return target["_readers"].toLog.getReader();
                    };
                }else if(prop == "readAllLog"){
                    // 返回一个 Promise 来异步读取日志
                    return async () => {
                        //保证被初始化
                        if(!target["_readers"]){
                            const [toClient, toLog] = target.tee();
                            target["_readers"] = {
                                toClient,
                                toLog
                            }
                        }
                        const decoder = new TextDecoder();
                        let result = "";
                        const reader = target["_readers"].toLog.getReader();
                        try {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                result += decoder.decode(value, { stream: true });
                            }
                            result += decoder.decode(); // 完成解码
                        } finally {
                            reader.releaseLock();
                        }
                        return result;
                    };
                }


                return value;
            },
            set(obj, prop, value) {
                obj[prop] = value;
                return true; // 必须返回 true
            }
        };
       return new Proxy(body, handler);
}


// 代理 Response 请求
export function proxyResponse(response){
      const target = { name: "Alice", age: 25 };
        const handler = {
            get(obj, prop) {
                //console.log(`读取属性: ${prop}`);
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
                //console.log(`设置属性: ${prop} = ${value}`);
                obj[prop] = value;
                return true; // 必须返回 true
            }
        };
       return new Proxy(response, handler);
}


