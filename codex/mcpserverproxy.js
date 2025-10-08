import JsonRpcClient from "./mcpclient.js"
import { pathToFileURL } from "url";
import readline from 'node:readline';
import {getOptions} from "../untils.js"

// ---- 2) JSON-RPC 帮助函数 ----
function send(resultOrError, id) {
  const msg = { jsonrpc: '2.0', ...(resultOrError.error ? { error: resultOrError.error } : { result: resultOrError.result }), id };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function error(code, message, data) {
  return { error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function ok(result) {
  return { result };
}
let  mcpServerName = getOptions().mcpServerName;
if(!mcpServerName){
   console.error("MCP server name is required --mcpServerName=supabase");
   process.exit(1);
}

console.log("执行代理 MCPServer " + mcpServerName);

let  mcpclient  = new JsonRpcClient();

// ---- 3) 处理 JSON-RPC 请求 ----
async function handleRequest({ id, method, params }) {
  try {
    // a) 初始化握手（极简实现）
    if (method === 'initialize') {
    
    
      /**   
      return send(
        ok({
          protocolVersion: '2025-03-26', // 示例：协议版本字符串
          capabilities: { tools: {} },   // 表示支持工具子协议
          serverInfo: { name: 'Supabase', version: '0.0.1' },
        }),
        id,
      );
      */
        let res = await mcpclient.call(`${mcpServerName}_initialize`);
        //console.log(res);
        return send(ok(res), id);
    }

    // b) 列出工具
    if (method === 'tools/list') {
        let tools = await mcpclient.call(`${mcpServerName}_list`);
        return send(ok(tools), id);
    }

    // c) 调用工具
    if (method === 'tools/call') {
        let result = await mcpclient.call(`${mcpServerName}_call`, params);
        return send(ok(result ?? { content: [] }), id);      
    }

    // d) 可选心跳
    if (method === 'ping') return send(ok({}), id);

    // e) 未实现的方法
    return send(error(-32601, `Method not found: ${method}`), id);
  } catch (e) {
    return send(error(-32603, 'Internal error', { message: String(e?.message || e) }), id);
  }
}

// ---- 4) 读 STDIN（每行一个 JSON-RPC 消息） ----
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    // 非法 JSON：按 JSON-RPC 返回解析错误
    return send(error(-32700, 'Parse error'), null);
  }

  // 只处理 Request；Notification 没有 id
  if (msg?.jsonrpc !== '2.0' || typeof msg?.method !== 'string') {
    return send(error(-32600, 'Invalid Request'), msg?.id ?? null);
  }
  // 异步处理
  handleRequest(msg);
});

// 可选：把错误打印到 stderr（不影响 JSON-RPC 数据流）
process.on('uncaughtException', (e) => console.error('uncaught:', e));
process.on('unhandledRejection', (e) => console.error('unhandled:', e));

//console.log(`mcpclient.call('${mcpServerName}_list')`);
//let tools = await mcpclient.call(`${mcpServerName}_list`);
//console.log(JSON.stringify(tools, null, 2));
async function main(){
   console.log(`mcpclient.call('${mcpServerName}_initialize')`);
  let initialize = await mcpclient.call(`${mcpServerName}_initialize`);
   console.log(JSON.stringify(initialize, null, 2));
}

/**
 * 判断当前模块是否是主运行模块：
 * ✅ node xxx.js 直接执行 → true
 * 🚫 import 时 → false
 * 🚫 子进程 (spawn/fork) 启动时 → false
 */
export function isMainModule() {
  // 当前模块文件 URL
  const currentFile = pathToFileURL(process.argv[1]).href;

  // 是否为直接运行
  const isDirectRun = import.meta.url === currentFile;

  // 是否为子进程
  const isChildProcess =
    process.send !== undefined ||
    process.env.__IS_SUBPROCESS__ === "1" ||
    (process.ppid !== 1 && process.ppid !== process.pid);
   console.log("isChildProcess:",  isDirectRun && !isChildProcess);
  return isDirectRun && !isChildProcess;
}

//if(isMainModule()){
//  main();
//}
