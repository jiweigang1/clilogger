//import {} from "./clogger.js"
//import Anthropic from "@anthropic-ai/sdk";

import {proxyResponse } from "./untils.js";
/**

const anthropic = new Anthropic({
  apiKey: "sk-ebbd5d38fee74071844d826c5d6909da",                         // 你的 key
  // 如果你走 DeepSeek 的 Anthropic 兼容端点，也加上 baseURL：
   baseURL: "https://api.deepseek.com/anthropic",
});

const message = await anthropic.messages.create({
  model: "deepseek-chat",        // 用冒号
  max_tokens: 1000,
  system: "You are a helpful assistant.",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Hi, how are you?" }
      ]
    }
  ]
});

console.log(message.content);    // 用 console.log 而不是 print


 */




const res = proxyResponse(await fetch("https://example.com"));

// 原始 response.body 还没锁
console.log(res.body.locked); // false

// 分叉 body
const [body1, body2] = res.body.tee();

// 原始 body 已被锁
console.log(res.body.locked); // true

// 两个分支可以独立消费
const text1 = await new Response(body1).text();
const text2 = await new Response(body2).text();

console.log(text1.slice(0, 50));
console.log(text2.slice(0, 50));
