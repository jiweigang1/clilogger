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

