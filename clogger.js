import logger from './logger.js';
import mergeAnthropicChunks  from './api.js';

logger.debug("-------------Clogger Start--------------------------");
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
// 输入和输出日志可以打印在一个 JSON 结构中
function instrumentFetch() {
  if (!global.fetch || global.fetch.__ProxyInstrumented) return;
  
  logger.debug("-------------Clogger instrumentFetch--------------------------");

  const originalFetch = global.fetch;
  global.fetch = async (input, init = {}) => {
	
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
	
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
	  
	  //请求和返回返到一起
	  let log = {request:obody};
	  
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
				log.response = mergeAnthropicChunks(allchunk);
				//console.log(JSON.stringify(log.response, null, 2));
				logger.debug(log);
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
		//console.log(log);
		//console.log(res);
		log.response = res;
		//执行响应日志打印
		logger.debug(log);
		console.log(log);
        return new Response(JSON.stringify(res), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }
  };
  global.fetch.__ProxyInstrumented = true;
}

instrumentFetch();