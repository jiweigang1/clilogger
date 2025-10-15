#!/usr/bin/env node

global.CLI_TYPE = "claude"
import {initConfig,loadConfig} from "./config.js"
import readline from 'readline';
import { spawn } from 'child_process';
import {getClaudePath} from './untils.js';
import inquirer from 'inquirer';
import path  from "path";
import { fileURLToPath, pathToFileURL } from "url";
import LogManager from './logger-manager.js';

const logger = LogManager.getSystemLogger();

/**
 * 启动 calude code
 */
function start(){
    initConfig();
    let allConfig = loadConfig();
    let choices = [];
    Object.entries(allConfig).forEach(([key, value], index) => {
        if (value.enable === true) {
            choices.push({ name: `${index}. ${key}`, value: key });
        }
    });

    // 检查是否有启用的模型
    if (choices.length === 0) {
        console.error("错误：没有启用的模型配置！");
        console.log("请检查配置文件，确保至少有一个模型的 enable 设置为 true。");
        logger.error("没有启用的模型配置，程序退出");
        process.exit(1);
    }

    (async () => {
        const answers = await inquirer.prompt([
            {
            type: "list",      // 单选模式
            name: "choice",    // 返回结果的 key
            message: "请选择一个模型：",
            choices: choices
            }
        ]);

        var config = allConfig[answers.choice];
        let env =  config.env;
        // claudecode 环境变量是可以通过 env 传递到 mcpserver
        let claudePath = config?.CLAUDE_PATH || process.env.CLAUDE_PATH || getClaudePath();
        let dir = path.dirname(fileURLToPath(import.meta.url));
        if(answers.choice=="openrouter"){
            claudePath = "node --import " + pathToFileURL(path.join(dir, 'clogger-openai.js')) + " " + claudePath;
        }else{
             claudePath = "node --import "+ pathToFileURL(path.join(dir, 'clogger.js')) + " " + claudePath;
        }

            logger.debug(`启动 Claude 进程: ${claudePath}`);

        const child = spawn(claudePath,[],{
                env:{
                    ...env,
                     PIPE_PATH_PRE: process.pid
                },
                stdio: 'inherit', // 继承父进程 stdio，方便交互,
                shell: true
            }
        );

        child.on("error", (error) => {
            console.error("Failed to start claude command:", error.message);
            logger.debug(
                "Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code"
            );
            process.exit(1);
        });

        child.on("close", (code) => {
            process.exit(code || 0);
        });
       

    })();



}
// 这里需要判断是否启动完成，不然后面 mcp 会连接失败
/** 
function startMCPServerProxy(){
   let dir = path.dirname(fileURLToPath(import.meta.url));
   // 启动 MCP 代理服务
   const child = spawn("node " + (path.join(dir, "mcp" ,'claude-mcpproxy-launcher.js')), [], {
       stdio: "pipe" ,
       shell: true,
       env: {
           PIPE_PATH_PRE: process.pid
       }
   });

   child.stdout.on("data", (data) => {
        console.log("子进程输出:", data.toString());
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

async function startMCPServerProxy() {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const child = spawn("node " + path.join(dir, "mcp", "claude-mcpproxy-launcher.js"), [], {
      stdio: "pipe",
      shell: true,
      env: {
        PIPE_PATH_PRE: process.pid
      }
    });

    child.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      //console.log("子进程输出:", msg);
      if (msg.includes("ok_ok")) {
        resolve("MCP server proxy started successfully");
      }
    });

    child.stderr.on("data", (data) => {
      console.error("子进程错误输出:", data.toString());
    });

    child.on("error", (error) => {
      reject(new Error("Failed to start MCP server proxy: " + error.message));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("MCP server proxy exited with code " + code));
      }
    });
  });
}

async function main(){
  console.log("Starting MCP server proxy...");
  await startMCPServerProxy();
  console.log("MCP server proxy started successfully.");
  start();
}
await main();