import os   from 'os';
import path from 'path';
import fs from 'fs';

let defaultConfig = {
    "deepseek":{
        enable:false,
        evn:{

        }
    },
    "kimi-k2":{
        enable:false,
         evn:{
            
        }
    },
    "openrouter":{
         enable:false,
          evn:{
            
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
      fs.writeFileSync(dir, JSON.stringify(defaultConfig));
  } 
}

export  function loadConfig(){
   const data = fs.readFileSync(getConfigDir(), 'utf-8');
   return JSON.parse(data);
}