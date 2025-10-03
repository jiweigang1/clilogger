// server.js
import Fastify from "fastify";
import {parseOpenAIResponse,parseOpenAIChatCompletion} from './api-opeai.js'
import LoggerManage from "./logger-manager.js" 
let  logger = LoggerManage.getLogger("codex");

//是否为 chat 模式调用
const wire_api = process.env.wire_api;
//访问的 Base URL 地址
const base_url = process.env.base_url;

console.log("Base URL:", base_url);
console.log("Wire API:", wire_api);

console.log(process.env);

function toSimple(full , wire_api){
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

function logAPI(fullLog,wire_api){
  logger.simple.debug(toSimple(fullLog,wire_api));
  logger.full.debug(fullLog);
} 

const fastify = Fastify(
    {
        requestTimeout: 0,          // never time out request (or set e.g. 10 * 60 * 1000)
        connectionTimeout: 0,       // no connection timeout
        keepAliveTimeout: 120000,   // 120s
    }
);

// 注册一个 POST 接口
fastify.all("/*", async (request, reply) => {
   //console.log("处理请求:", request.url);
   return await handel(request, reply, request.url);
});

/**
 * 判断是否为流式响应
 * @returns 
 */
function isStream(response){
    let contentType = response.headers.get('content-type') || '';
    const streamTypes = [
		    'text/event-stream',
        'chunked'
	  ];
	  if(streamTypes.some(t => contentType.includes(t))){
      return true;
    }
    contentType = response.headers.get('transfer-encoding') || '';
    if(streamTypes.some(t => contentType.includes(t))){
      return true;
    }
    return false;
}

function headersToObject(headers) {
  const obj = {};
  try {
    for (const [k, v] of headers.entries()) obj[k] = v;
  } catch {}
  return obj;
}

/**
 * SSE 解析器：event: ...\ndata: ...\n\n" 块解析成 { event, data } ---
 * SSE 是以空行分割
 * @param {*} stream 
 */
async function* streamGenerator(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
           yield buffer;
			     break;
		    }

        const event = decoder.decode(value, { stream: true });
      
        buffer += event;
        //event 是以完整换行符 ，有换行符是完整的chunk
        const lines = buffer.split('\n\n');
        //最后一行可能是不完整的，等到最后一次处理
        buffer = lines.pop();
        //处理已经接收的完整 event 一次 read 得到多个chunk是正常的
        for (const line of lines) {
			    //返回原始文本,解析出日志的内容。
			    yield line;
        }
    }
}

function joinUrl(base, ...paths) {
  return [base.replace(/\/+$/, ''), ...paths.map(p => p.replace(/^\/+/, ''))]
    .join('/');
}
async function handel(request, reply, endpoint){
    try {
    const body = request.body;
    // 取出原始请求头
    let incomingHeaders = { ...request.headers };

    // 删除或覆盖一些不适合直接转发的头
    delete incomingHeaders["host"];       // Host 由 fetch 自动设置
    delete incomingHeaders["content-length"]; // 长度 fetch 会重新计算
    delete incomingHeaders["accept"];
    
    let url  = joinUrl(base_url,endpoint);
    console.log("向endpoint 发送请求：" + url);

    const response = await fetch(url, {
      method: "POST",
      headers: incomingHeaders,
      body: JSON.stringify(body)
    });



     //完整的请求日志，保护请求和响应
	  let fullLog = {request:{
        headers: incomingHeaders,
        body: body
      },response:{
            status: response.status,
            statusText: response.statusText,
            headers: headersToObject(response.headers)
      }};

   let headers = headersToObject(response.headers);

    if(!isStream(response)){
        console.log("处理非流式响应");
        // 把外部响应头加到 reply
        for (const [key, value] of response.headers.entries()) {
            reply.header(key, value);
        }
        const res = await response.text();
        return reply.send(res);
    }else{
        

      // 使用 tee：一支直接转发字节，一支本地解析日志
    const [toClient, toLog] = response.body.tee();

    // 同时在后台解析日志（不影响直通）
    (async () => {
      if(wire_api == "chat"){
        fullLog.response.body =  await parseOpenAIChatCompletion(toLog.getReader());
      }else if(wire_api == "responses"){
        fullLog.response.body =  await parseOpenAIResponse(toLog.getReader());
      }
      //其他类型是错误的
      logAPI(fullLog,wire_api);

    })().catch(err => console.error('日志解析错误:', err));

    // 直通上游字节给客户端：不要 decode/encode
    return reply.send(toClient);
       

    }
  } catch (err) {
     console.log("处理流式响应异常");
     console.error(err);
    return reply.status(500).send({ error: "请求失败" });
  }
}

// 启动服务
const startServer = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("✅ Server started");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
startServer();