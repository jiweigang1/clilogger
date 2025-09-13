import {} from "./clogger.js"
import Anthropic from "@anthropic-ai/sdk";

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