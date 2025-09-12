import {} from "./clogger.js"

const postUrl = 'https:www.baidu.com';

async function postData() {
  try {
    const response = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Hello Fetch',
        body: '这是使用 Node.js fetch 发送的请求',
        userId: 123,
      }),
    });

    if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);
    const result = await response.body();
    console.log('POST 响应数据:', result);
  } catch (err) {
    console.error('请求失败:', err);
  }
}

postData();