import {mergeAnthropic}  from './api-anthropic.js';
import LoggerManage from "./logger-manager.js" 
import { URL } from 'url';
let  logger = LoggerManage.getLogger("claudecode");

logger.system.debug("-------------Clogger Start--------------------------");

function deepClone(obj) {
  const result = JSON.parse(JSON.stringify(obj));
  return result;
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
		    '/v1/messages'
	  ];

    let urlPath = (new URL(url)).pathname;

    if(!(endpoints.some(t => urlPath.includes(t) && init.method == "POST"))){
       logger.system.debug("不是模型请求直接返回" +init.method +":" + url +" -> " + urlPath);
       return originalFetch(input,init);
    }

    //打印请求信息 init.body
    let response = await originalFetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
    });
	
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
        body: JSON.parse(init.body)
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
