async function* streamGenerator(stream,log) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let res = '';
	
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
			log.reqponse = res;
			//执行日志打印
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

  const originalFetch = global.fetch;
  global.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

     let log = {request:init.body};

    //打印请求信息 init.body
    const response = await originalFetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
    });

    if (isStream) {
        const transformedStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                for await (const chunk of streamGenerator(response.body,log)) {
                    controller.enqueue(encoder.encode(chunk));
                }
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
		log.response = res;
		//执行响应日志打印
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