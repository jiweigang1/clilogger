import {mergeAnthropic}  from './api-anthropic.js';
import LoggerManage from "./logger-manager.js" 
import { URL } from 'url';
import anthropicTransformer from  "./anthropic-transformer.js"
import {parseOpenAIChatCompletion} from "./api-openai.js";
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
function toSimpleLog(full, wire_api = "chat"){
   let log = {
      request:{},
      response:{},
      openai:{
        request:{},
        response:{}
      }
  }
    //anthropic 转换
    log.request.model = full.request.body.model;
    log.request.messages = full.request.body.messages;
    log.request.system = full.request.body.system;
    log.response.content = full.response.body.content;

    // openai 转换
    log.openai.request.model = full.openai.request.body.model;
    log.openai.request.messages = full.openai.request.body.messages;
    log.openai.response.choices = full.openai.response.body.choices;


  return log; 
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
  
  logger.system.debug("-------------Clogger instrumentFetch--------------------------");

  const originalFetch = global.fetch;
  global.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const endpoints = [
		    '/v1/messages'
	  ];
    let urlPath = (new URL(url)).pathname;

    if(!(endpoints.some(t => urlPath.includes(t) && init.method == "POST"))){
       //console.log("不是模型请求直接返回" +init.method +":" + url +" -> " + urlPath);
       return originalFetch(input,init);
    }

    //console.log("请求地址: " + url);
    //转换前的请求
    let initBody    = JSON.parse(init.body);
    //请求的 JSON 
    let requestBody = await anthropicTransformer.transformRequestOut(initBody);
    //转换后的请求
    let openaiRequestBodyString = JSON.stringify(requestBody);
        
    //console.log(JSON.parse(openaiRequestBody));
   
    //打印请求信息 init.body
    const response = await originalFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ANTHROPIC_AUTH_TOKEN}`
      },
      body: openaiRequestBodyString,
    });

    let responseToClient = response.clone();
     
	  //完整的请求日志，保护请求和响应
	  let fullLog = {request:{
        url:url,
        method: init.method,
        headers: headersToObject(init.headers),
        body: initBody
      },response:{
            status: response.status,
            statusText: response.statusText,
            headers: headersToObject(response.headers)
      },openai:{
        request: {
           body: requestBody
        },
        response: {}
      }};

    let         res = await anthropicTransformer.transformResponseIn(responseToClient);
    let toClientRes = await res.clone();

    (async () => {
       
      fullLog.openai.response.body  =  await parseOpenAIChatCompletion(await response.text());
      fullLog.response.body         =  mergeAnthropic(await res.text());

      //其他类型是错误的
      logAPI(fullLog);

    })().catch(err => console.error('日志解析错误:', err));

    return toClientRes;
	  
	 
  };
  global.fetch.__ProxyInstrumented = true;
}
try{
  instrumentFetch();
}catch(e){
    logger.system.error(e);
}
