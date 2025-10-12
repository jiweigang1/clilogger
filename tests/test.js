import {} from "../clogger.js"
import Anthropic from "@anthropic-ai/sdk";


const anthropic = new Anthropic({
   apiKey: "sk-c1GF5uhjQpEcfqYZE3XvGf85XGpG7Rhj6E5829M3qoawzDzu",                         // 你的 key
  // 如果你走 DeepSeek 的 Anthropic 兼容端点，也加上 baseURL：
   baseURL: "https://api.moonshot.cn/anthropic",
});

const message = await anthropic.messages.create({
  model: "kimi-k2-0905-preview",        // 用冒号
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





