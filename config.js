import os   from 'os';
import path from 'path';
import fs from 'fs';

let defaultConfig = {
    "deepseek":{
        enable:false,
        env:{
             ANTHROPIC_BASE_URL:"https://api.deepseek.com/anthropic",
             ANTHROPIC_AUTH_TOKEN:"sk-1d24ce50f03647858f73d5ae25f018ea",
             API_TIMEOUT_MS:"600000",
             ANTHROPIC_MODEL:"deepseek-chat",
             ANTHROPIC_SMALL_FAST_MODEL:"deepseek-chat",
             CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:"1"
        }
    },
    "kimi-k2":{
        enable:false,
         env:{
            ANTHROPIC_BASE_URL:"https://api.moonshot.cn/anthropic",
            ANTHROPIC_AUTH_TOKEN:"sk-c1GF5uhjQpEcfqYZE3XvGf85XGpG7Rhj6E5829M3qoawzDzu",
            ANTHROPIC_MODEL:"kimi-k2-0905-preview",
            ANTHROPIC_SMALL_FAST_MODEL:"kimi-k2-0905-preview"
        }
    },
    /**
     * "anthropic/claude-sonnet-4",
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3.7-sonnet:thinking"
     */
    "openrouter":{
         enable:false,
          env:{
            "ANTHROPIC_BASE_URL": "http://127.0.0.1:3000",
            "ANTHROPIC_AUTH_TOKEN": "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",
            "ANTHROPIC_MODEL": "anthropic/claude-sonnet-4",
            "ANTHROPIC_SMALL_FAST_MODEL": "anthropic/claude-sonnet-4"
        }
    }
}

function getConfigDir(){
  let home = os.homedir();
  return path.join(home, ".clilogger", "config.json");
}

/**
 * init config dir
 */
export function initConfig(){
  //如果路径不存在，创建
  let dir =  getConfigDir();   
  if (!fs.existsSync(dir)){
      //创建初始化文件
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      fs.writeFileSync(dir, JSON.stringify(defaultConfig,null, 2));
  } 
}

export  function loadConfig(){
   const data = fs.readFileSync(getConfigDir(), 'utf-8');
   return JSON.parse(data);
}



let defaultMCPConfig = {
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "bearer_token":"sbp_xxxxx"
    }
  }

}


function getMCPConfigDir(){
  let home = os.homedir();
  return path.join(home, ".clilogger", "mcp.json");
}

/**
 * init config dir
 */
export function initMCPConfig(){
  //如果路径不存在，创建
  let dir =  getMCPConfigDir();   
  if (!fs.existsSync(dir)){
      //创建初始化文件
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      fs.writeFileSync(dir, JSON.stringify(defaultMCPConfig,null, 2));
  } 
}

export  function loadMCPConfig(){
   const data = fs.readFileSync(getMCPConfigDir(), 'utf-8');
   return JSON.parse(data);
}