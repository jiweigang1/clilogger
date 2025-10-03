import {mergeAnthropic}  from './api-anthropic.js';
import LoggerManage from "./logger-manager.js" 
import { URL } from 'url';
import { proxyResponse } from './untils.js';
import { Readable } from 'node:stream';
let  logger = LoggerManage.getLogger("claudecode");

logger.full.debug("-------------Clogger Start--------------------------");

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

async function* streamGenerator(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
			break;
		}

        const chunk = decoder.decode(value, { stream: true });
      
        buffer += chunk;
        //chunk 是以换行符分割 chunk的，有换行符是完整的chunk
        const lines = buffer.split('\n');
        //最后一行可能是不完整的，等到最后一次处理
        buffer = lines.pop();
        //处理已经接收的完整 chunk 一次read 得到多个chunk是正常的
        for (const line of lines) {
			 //返回原始文本,解析出日志的内容。
			 yield line;
        }
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
  
  console.log("-------------Clogger instrumentFetch--------------------------");

  const originalFetch = global.fetch;
  global.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
	
    const endpoints = [
		    '/v1/messages'
	  ];
    let urlPath = (new URL(url)).pathname;

    if(!(endpoints.some(t => urlPath.includes(t) && init.method == "POST"))){
       console.log("不是模型请求直接返回" +init.method +":" + url +" -> " + urlPath);
       return originalFetch(input,init);
    }

    //打印请求信息 init.body
    let response = await originalFetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
    });
	
    response = proxyResponse(response);

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
        let alllog = await response.body.readAllLog();
        //logger.full.debug("alllog "+alllog)
        fullLog.response.body = mergeAnthropic(alllog);     
        logAPI(fullLog);
      return new Response(Readable.fromWeb(response.body), {
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
    console.log(e);
}
