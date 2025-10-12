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
        choices.push({ name: `${index}. ${key}`, value: key });
    });

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
function startMCPServerProxy(){
   let dir = path.dirname(fileURLToPath(import.meta.url));
   // 启动 MCP 代理服务
   const child = spawn("node " + (path.join(dir, "mcp" ,'claude-mcpproxy-launcher.js')), [], {
       stdio: 'inherit',
       shell: true,
       env: {
           PIPE_PATH_PRE: process.pid
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
function main(){
  startMCPServerProxy();
  start();
}
main();