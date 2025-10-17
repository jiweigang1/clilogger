import {mergeAnthropic}  from './api-anthropic.js';
import LoggerManage from "./logger-manager.js"
import { URL } from 'url';
import { readFileSync } from 'fs';
import { join } from 'path';

let  logger = LoggerManage.getLogger("claudecode");

logger.system.debug("-------------Clogger Start--------------------------");

// 配置文件相关功能
let toolsConfig = {
  blacklist: [],
  descriptions: {}
};

function loadToolsConfig() {
  try {
    const configPath = join(process.cwd(), '.tools.json');
    const configContent = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    if (config.tools) {
      toolsConfig.blacklist = config.tools.blacklist || [];
      toolsConfig.descriptions = config.tools.descriptions || {};
      logger.system.debug(`成功加载配置文件，黑名单: ${toolsConfig.blacklist.length} 个工具，描述重写: ${Object.keys(toolsConfig.descriptions).length} 个工具`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.system.debug('未找到 .tools.json 配置文件，使用默认配置');
    } else {
      logger.system.error(`加载配置文件失败: ${error.message}`);
    }
  }
}

// 在启动时加载配置
loadToolsConfig();

function deepClone(obj) {
  const result = JSON.parse(JSON.stringify(obj));
  return result;
}

// 处理请求body中的tools，应用黑名单过滤和描述改写
function processRequestTools(body) {
  if (!body || !body.tools || !Array.isArray(body.tools)) {
    return body;
  }

  const originalCount = body.tools.length;

  // 过滤黑名单中的工具
  body.tools = body.tools.filter(tool => {
    const toolName = tool.name || tool.function?.name;
    if (!toolName) return true;

    const isBlacklisted = toolsConfig.blacklist.includes(toolName);
    if (isBlacklisted) {
      logger.system.debug(`过滤黑名单工具: ${toolName}`);
    }
    return !isBlacklisted;
  });

  // 改写工具描述
  body.tools = body.tools.map(tool => {
    const toolName = tool.name || tool.function?.name;
    if (toolName && toolsConfig.descriptions[toolName]) {
      logger.system.debug(`改写工具描述: ${toolName} -> ${toolsConfig.descriptions[toolName]}`);

      // 根据工具结构更新描述
      if (tool.description !== undefined) {
        tool.description = toolsConfig.descriptions[toolName];
      } else if (tool.function && tool.function.description !== undefined) {
        tool.function.description = toolsConfig.descriptions[toolName];
      }
    }
    return tool;
  });

  const filteredCount = body.tools.length;
  if (originalCount !== filteredCount) {
    logger.system.debug(`工具过滤完成: ${originalCount} -> ${filteredCount}`);
  }

  return body;
}
function formateLine(str){
    let r = str.replace(/\\n/g, '\n');
    return r;
}
function toSimpleLog(fullLog){
    //删除 tool 列表
    let  slog = deepClone(fullLog);
    let result = {
        request:slog.request.body.messages,
        response:slog.response.body.content
    };
    return result;
}

function logAPI(fullLog){
    //console.log('Writing to log files...');
    try {
        logger.full.debug(fullLog);
        logger.simple.debug(toSimpleLog(fullLog));

        // 立即同步到文件
        if (logger.full.flush) {
            logger.full.flush();
        }
        if (logger.simple.flush) {
            logger.simple.flush();
        }

       // console.log('Log files written successfully');
    } catch (error) {
        console.error('Error writing to log files:', error);
    }
}

function headersToObject(headers) {
  const obj = {};
  try {
    for (const [k, v] of headers.entries()) obj[k] = v;
  } catch {}
  return obj;
}

/**
 * 
 *  
 * 拦截 claude  code 请求，这里应该拦截模型情况。当前拦截了所有的请求，模型请求可以通过 endpoint 判断出来
 * 当前的逻辑需要优化
 * 
 */
 
function instrumentFetch() {
  if (!global.fetch || global.fetch.__ProxyInstrumented) return;
  
  logger.system.debug("-------------Clogger instrumentFetch--------------------------");

  const originalFetch = global.fetch;
  global.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const endpoints = [
		    '/v1/messages',
			'/anthropic/v1/messages'
	  ];

    let urlPath = (new URL(url)).pathname;

    if(!(endpoints.some(t => urlPath.includes(t) && (init.method == "POST" || init.method == "post" )     ))){
       logger.system.debug("不是模型请求直接返回" +init.method +":" + url +" -> " + urlPath);
       return originalFetch(input,init);
    }

    //打印请求信息 init.body
    let processedBody = init.body;

    // 如果是模型请求，处理请求body中的tools
    if (init.body) {
      try {
        const bodyObj = JSON.parse(init.body);
        const processedBodyObj = processRequestTools(bodyObj);
        processedBody = JSON.stringify(processedBodyObj);

        if (processedBody !== init.body) {
          logger.system.debug('请求body中的tools已被处理');
        }
      } catch (error) {
        logger.system.error(`处理请求body失败: ${error.message}`);
        // 如果处理失败，使用原始body
        processedBody = init.body;
      }
    }
	//如果对 tools 修改了这里的长度肯定要变化的
	let requestHeaders = {...init.headers}
	    delete requestHeaders["content-length"]; //可能还有大小写问题 
		//console.log(requestHeaders);
	
	let response;
	try{
		  response = await originalFetch(url, {
			  method: init.method,
			  headers: requestHeaders,
			  body: processedBody,
		  });
		
	}catch(e){
		console.log(e);
	}

    
	
    //logger.full.debug("13132131313");
    //response = proxyResponse(response);
    let responseToClient = response.clone()
    // stream 不能通过 content type 判断，
    let isStream = true;
    if(Object.hasOwn(init.body, "stream") &&  !init.body.stream){
        isStream = false;
        logger.full.debug("模型不是流请求");
    }
	

	  //完整的请求日志，保护请求和响应
	  let fullLog = {request:{
        url:url,
        method: init.method,
        headers: headersToObject(init.headers),
        body: JSON.parse(processedBody)
      },response:{
            status: response.status,
            statusText: response.statusText,
            headers: headersToObject(response.headers)
      }};

      //logger.full.debug("1111111111111>>>>>>" );
  
      try{
          //日志解析要异步执行保证效率
          (async ()=>{
            if(isStream){
              let alllog = await response.text();
              //logger.full.debug("alllog "+alllog)
              fullLog.response.body = mergeAnthropic(alllog);   
            }else{
               fullLog.response.body = await response.json();
            }
			
           // logger.full.debug("adassdadadadad>>>>>>" + JSON.stringify(fullLog));
           
            logAPI(fullLog);

          })().catch(err => logger.system.error('日志解析错误:' + "\nStack trace: " + err.stack));
        


        return new Response(responseToClient.body, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
        });
      }catch(e){
        logger.system.error(e);
      }
  };
  global.fetch.__ProxyInstrumented = true;
}

try{
  instrumentFetch();
}catch(e){
    logger.system.error(e);
}
