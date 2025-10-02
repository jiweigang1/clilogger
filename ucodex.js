#!/usr/bin/env node

import TOML from '@iarna/toml';
import path  from 'path';
import os from 'os';
import fs from "fs";
import { spawn } from 'child_process';


// 启动服务
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


  const child = spawn('node ./ucodex-proxy.js', [],{
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
    console.error(`子进程 stderr: ${data}`);
  });

  child.on('close', (code) => {
    console.log(`codex 退出，退出码: ${code}`);
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

  const child = spawn('codex', configCmd,{
    stdio: 'inherit', // 继承父进程 stdio，方便交互
    shell: true,
    env:{
      ...process.env,
      ...env
    }
  });


  child.on('close', (code) => {
    console.log(`codex 退出，退出码: ${code}`);
  });

}

function  main(){
   startServer();
	 startCodexcli();
}
main();