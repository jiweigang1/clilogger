#!/usr/bin/env node

import {initConfig,loadConfig} from "./config.js"
import readline from 'readline';

/**
 * 启动 calude code
 */
function start(){
   initConfig();
   let allConfig = loadConfig();
  
   console.log(allConfig);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // 提供选项并让用户选择
    rl.question("选择模型：1、deepseek ， 2、kimi、 3、openrouter", (answer) => {
        console.log(allConfig);
        // 根据用户的输入判断选择
        var config = allConfig["deepseek"];
        let env =  config.env;
        const stdioConfig = config.NON_INTERACTIVE_MODE
            ? ["pipe", "inherit", "inherit"] // Pipe stdin for non-interactive
            : "inherit"; // Default inherited behavior
        
        let claudePath = config?.CLAUDE_PATH || process.env.CLAUDE_PATH || "claude";
    
            claudePath = "--import /Users/jigang/Javaworks/clilogger/clogger.js " + claudePath    
        const claudeProcess = spawn(
            claudePath,
            [],
            {
            env,
            stdio: stdioConfig,
            shell: true,
            }
        );

        // Close stdin for non-interactive mode
        if (config.NON_INTERACTIVE_MODE) {
            claudeProcess.stdin?.end();
        }

        claudeProcess.on("error", (error) => {
            console.error("Failed to start claude command:", error.message);
            console.log(
            "Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code"
            );
            decrementReferenceCount();
            process.exit(1);
        });

        claudeProcess.on("close", (code) => {
            decrementReferenceCount();
            closeService();
            process.exit(code || 0);
        });

         // 关闭接口
        rl.close();
    });
}
start();