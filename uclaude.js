#!/usr/bin/env node

import {initConfig,loadConfig} from "./config.js"
import readline from 'readline';
import { spawn } from 'child_process';
import {getClaudePath} from './untils.js';
import inquirer from 'inquirer'

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
        let claudePath = config?.CLAUDE_PATH || process.env.CLAUDE_PATH || getClaudePath();
        if(answers.choice=="openrouter"){
            claudePath = "node --import ./clogger-openai.js " + claudePath 
        }else{
             claudePath = "node --import ./clogger.js " + claudePath 
        } 

            console.log(`启动 Claude 进程: ${claudePath}`);

        const child = spawn(claudePath,[],{
                env,
                stdio: 'inherit', // 继承父进程 stdio，方便交互,
                shell: true
            }
        );

        child.on("error", (error) => {
            console.error("Failed to start claude command:", error.message);
            console.log(
                "Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code"
            );
            process.exit(1);
        });

        child.on("close", (code) => {
            process.exit(code || 0);
        });
       

    })();



}
start();