import mergeAnthropicChunks  from './api-anthropic.js';
import LoggerManage from "./logger-manager.js" 
import { URL } from 'url';
import anthropicTransformer from  "./anthropic-transformer.js"
import {parseOpenAIChatCompletion} from "./api-opeai.js";
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
function toSimpleLog(full, wire_api = "chat"){
   let log = {
      request:{},
      response:{}
  }
  if(wire_api === "chat"){
    log.request.model = full.request.body.model;
    log.request.messages = full.request.body.messages;
    log.response.choices = full.response.body.choices;
  }else{
    log.request.session_id = full.request.headerssession_id;
    log.request.model = full.request.body.model;
    log.request.instructions = full.request.body.instructions;
    log.request.input = full.request.body.input;
    log.response.output = full.response.body.output;
  }
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
  
  console.log("-------------Clogger instrumentFetch--------------------------");

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

      //console.log("请求地址完成-->: " + url);
      //console.log({
      //  "Content-Type": "application/json",
      //  Authorization: `Bearer ${process.env.ANTHROPIC_AUTH_TOKEN}`
      //})
	

    //for (const [key, value] of response.headers.entries()) {
    //    console.log(`${key}: ${value}`);
    //}

	  const contentType = response.headers.get('content-type') || '';
    const types = [
		    'text/event-stream',
        'application/json'
	  ];
    // 如果不是JSON返回格式不进行处理
    //text/event-stream; charset=utf-8  注意后面会有参数，不能直接相等比较，要使用包含
	  if(!types.some(t => contentType.includes(t))){
      let text = await response.text();
      console.log("返回结果无法处理: " + url + " " + contentType + "\n -> " + text);
      return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
      });
    }
	  
	  //完整的请求日志，保护请求和响应
	  let fullLog = {request:{
        url:url,
        method: init.method,
        headers: headersToObject(init.headers),
        body: requestBody
      },response:{
            status: response.status,
            statusText: response.statusText,
            headers: headersToObject(response.headers)
      }};

     //console.log(JSON.stringify(fullLog, null, 2));
	  
	  const streamTypes = [
		    'text/event-stream'
	  ];
	  const isStream = streamTypes.some(t => contentType.includes(t));
    if (isStream) {
        //console.log("返回为流式请求");
        //日志和返回内容分开处理提高性能
        const [toClient, toLog] = response.body.tee();
         // 同时在后台解析日志（不影响直通）
        (async () => {
          fullLog.response.body =  await parseOpenAIChatCompletion(toLog.getReader());
          //其他类型是错误的
          logAPI(fullLog);
    
        })().catch(err => console.error('日志解析错误:', err));

        //console.log("开始流式请求转换");
        return await anthropicTransformer.transformResponseIn(toClient);
    
    //非流式请求处理   
    } else {
        //console.log("开始请求转换，当前不是流式请求");
        const data = await response.json();
		    //fullLog.response.body = res;
		    //执行响应日志打印
		    //logAPI(fullLog);
        //return await anthropicTransformer.transformResponseIn(toClient);
        //const data = await toClient.json();
        //console.log("转换后的非流式响应->:", data);
        const anthropicResponse =  anthropicTransformer.convertOpenAIResponseToAnthropic(data);
        return new Response(JSON.stringify(anthropicResponse), {
          headers: { "Content-Type": "application/json" },
        });
    }
  };
  global.fetch.__ProxyInstrumented = true;
}
try{
  instrumentFetch();
}catch(e){
    console.log(e);
}
