#!/usr/bin/env node

import {initConfig,loadConfig} from "./config.js"
import readline from 'readline';
import { spawn } from 'child_process';
import {getClaudePath} from './untils.js';

/**
 * 启动 calude code
 */
function start(){
    initConfig();
    let allConfig = loadConfig();
   //console.log(allConfig);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // 提供选项并让用户选择
    rl.question("选择模型：1、deepseek ， 2、kimi、 3、openrouter 请输入序号：\n", (answer) => {
        //console.log(allConfig);
        // 根据用户的输入判断选择
        var config = allConfig["deepseek"];
        let env =  config.env;
        let claudePath = config?.CLAUDE_PATH || process.env.CLAUDE_PATH || getClaudePath();
    
            claudePath = "node --import ./clogger.js " + claudePath    

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

         // 关闭接口
        rl.close();
    });
}
start();