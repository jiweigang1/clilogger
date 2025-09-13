import apiFullLogger,{apiSimpleLogger} from './logger.js';
import mergeAnthropicChunks  from './api.js';

apiFullLogger.debug("-------------Clogger Start--------------------------");

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
    //input.replace(/\\n/g, '\n')
    let result = {
        request:slog.request.body.messages,
        response:slog.response.body.content
    };
    /** 
    result.request.forEach((message, index) => {
        if(typeof message.content === "string"){
             message.content = formateLine(message.content);
        }else if(Array.isArray(message.content)){
            message.content.forEach((content, index) => {
                content.text = formateLine(content.text);
            });
        }
    });
    console.log(result);
    */

    return result;
}

function logAPI(fullLog){
    let slog = toSimpleLog(fullLog);
    apiFullLogger.debug(fullLog);
    apiSimpleLogger.debug(slog);
    //要及时输出
    apiFullLogger.flush();
    apiSimpleLogger.flush();
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

// 输入和输出日志可以打印在一个 JSON 结构中
function instrumentFetch() {
  if (!global.fetch || global.fetch.__ProxyInstrumented) return;
  
  console.log("-------------Clogger instrumentFetch--------------------------");

  const originalFetch = global.fetch;
  global.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
	
    //console.log(url);

   //如果没有 body 不处理	
   if(typeof(init?.body) == "undefined"){
	   return originalFetch(input,init);
   }
   
   let obody = JSON.parse(init.body);
   // events 类型不处理，后续需要研究
   if(obody.events){
	   return originalFetch(input,init);
   }
  
   //console.log(obody);
	
	
    //打印请求信息 init.body
    const response = await originalFetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
    });
	
	  const contentType = response.headers.get('content-type') || '';
	  // 如果不是JSON返回格式不进行处理
	  if(contentType !="application/json" && contentType !="text/event-stream"){
		  //console.log(contentType);
		  return response;
	  }
	  
	  //完整的请求日志，保护请求和响应
	  let fullLog = {request:{
        url:url,
        method: init.method,
        headers: headersToObject(init.headers),
        body: obody
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
        const transformedStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
				let allchunk = [];
                for await (const chunk of streamGenerator(response.body)) {
					allchunk.push(chunk);
					let ck = encoder.encode(chunk);
                    controller.enqueue(ck);
                }
                //console.log(JSON.stringify(fullLog.response, null, 2));
				fullLog.response.body = mergeAnthropicChunks(allchunk);
				logAPI(fullLog);
                controller.close();
            }
        });

        return new Response(transformedStream, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });

    } else {
        const res = await response.json();
		fullLog.response.body = res;
		//执行响应日志打印
		logAPI(fullLog);
        return new Response(JSON.stringify(res), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
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
