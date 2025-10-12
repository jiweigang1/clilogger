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
    logger.full.debug(fullLog);
    logger.simple.debug(toSimpleLog(fullLog));
    //要及时输出
    logger.simple.flush();
    logger.full.flush();
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
  
  logger.debug("-------------Clogger instrumentFetch--------------------------");

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
	
    //response = proxyResponse(response);
    let responseToClient = response.clone()

	  const contentType = response.headers.get('content-type') || '';
    const types = [
		    'text/event-stream',
        'application/json'
	  ];
    // 如果不是JSON返回格式不进行处理
    //text/event-stream; charset=utf-8  注意后面会有参数，不能直接相等比较，要使用包含
	  if(!types.some(t => contentType.includes(t))){
		   return response;
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

      try{
          //日志解析要异步执行保证效率
          (async ()=>{
            let alllog = await response.text();
            //logger.full.debug("alllog "+alllog)
            fullLog.response.body = mergeAnthropic(alllog);     
            logAPI(fullLog);
          })().catch(err => console.error('日志解析错误:', err));
        


        return new Response(responseToClient.body, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
        });
      }catch(e){
        logger.full.error(e);
      }
  };
  global.fetch.__ProxyInstrumented = true;
}
try{
  instrumentFetch();
}catch(e){
    logger.system.error(e);
}
