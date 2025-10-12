#!/usr/bin/env node

import TOML from '@iarna/toml';
import path  from "path";
import { fileURLToPath, pathToFileURL } from "url";
import os from 'os';
import fs from "fs";
import { spawn } from 'child_process';
import {getCodexPath} from './untils.js';
import {startMCPServerProxy} from "./codex/mcpserver.js"
import LogManager from "./logger-manager.js";
const logger = LogManager.getSystemLogger();


/**
 * codex 是 rust 开发，只能使用代理模式进行日志获取
 */
const startServer = async () => {
  let  tomlPath = path.join(os.homedir(), ".codex", "config.toml");
  const tomlString = fs.readFileSync(tomlPath, 'utf-8');
  const config = TOML.parse(tomlString);
  let env = {};
  //是否配置了三方模型
  if(config.model_provider){
     let base_url = config["model_providers"][config.model_provider]["base_url"];
     let wire_api =  config["model_providers"][config.model_provider]["wire_api"]? config["model_providers"][config.model_provider]["wire_api"]:"chat"
     env = {
       base_url,
       wire_api
     }  
  }else{
     env = {
      //默认访问只能是 这个地址
      base_url:"https://chatgpt.com/backend-api/codex",
      wire_api:"responses"
     }
  }

  let dir = path.dirname(fileURLToPath(import.meta.url));
  const child = spawn('node ' + path.join(dir, 'ucodex-proxy.js'), [],{
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env:{
      ...process.env,
      ...env
    }
  });

    // 监听标准输出
  child.stdout.on('data', (data) => {
    //console.log(`子进程 stdout: ${data}`);
  });

  // 监听错误输出
  child.stderr.on('data', (data) => {
    logger.error(`子进程 stderr: ${data}`);
  });

  child.on('close', (code) => {
    logger.debug(`codex 退出，退出码: ${code}`);
  });
};
/**
 * 启动 codex cli 
**/
function startCodexcli(){
  // 设置 base  url 的方式
  let env = {};
  let configCmd = [];

  let  tomlPath = path.join(os.homedir(), ".codex", "config.toml");
  const tomlString = fs.readFileSync(tomlPath, 'utf-8');
  const config = TOML.parse(tomlString);
  //是否配置了三方模型
  if(config.model_provider){
     let base_url = config["model_providers"][config.model_provider]["base_url"];
     let wire_api =  config["model_providers"][config.model_provider]["wire_api"]? config["model_providers"][config.model_provider]["wire_api"]:"chat"
     configCmd = ["--config", "model_providers." + config.model_provider+".base_url="+"http://127.0.0.1:3000"];
      
  }else{
     env = {
      "OPENAI_BASE_URL":"http://127.0.0.1:3000",
     }
  }

  const child = spawn("node  "+getCodexPath(), configCmd,{
    stdio: 'inherit', // 继承父进程 stdio，方便交互
    shell: true,
    env:{
      ...process.env,
      ...env
    }
  });


  child.on('close', (code) => {
    logger.debug(`codex 退出，退出码: ${code}`);
  });

}
/**
function startMCPServerProxy(){
   let dir = path.dirname(fileURLToPath(import.meta.url));
   // 启动 MCP 代理服务
   const child = spawn("node " + (path.join(dir, "mcp" ,'claude-mcpproxy-launcher.js')), [], {
       stdio: 'inherit',
       shell: true,
       env: {
         //  PIPE_PATH_PRE: process.pid
       }
   });

   child.on("error", (error) => {
       console.error("Failed to start MCP server proxy:", error.message);
       process.exit(1);
   });

   child.on("close", (code) => {
       process.exit(code || 0);
   });
}
  */ 

function  main(){
   startServer();
   startMCPServerProxy()
	 startCodexcli();
}
main();