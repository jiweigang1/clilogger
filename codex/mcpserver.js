import net from 'node:net';
import fs from 'fs';
import { pathToFileURL } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {loadMCPConfig,initMCPConfig} from "../config.js"
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client as OauthClient, StreamableHTTPClientTransport as  OauthStreamableHTTPClientTransport} from './mcp-client.js';
import {getMcpOauthTokensPath , getPipePath } from '../untils.js';
import LogManager from "../logger-manager.js";
const logger = LogManager.getSystemLogger();

const PIPE_PATH = getPipePath();
        initMCPConfig();
 let mcpConfig = loadMCPConfig();
/**
 * 启动 local mcp 服务
 * {
 *  command:""
 *  args:[]，
 *  evn：{}
 * }
 * @returns 
 */
async function createLocalClient(config){
  //让客户端以“子进程”方式拉起/连接本地 stdio server
  const transport = new StdioClientTransport({
    command:config.command,
    args:config.args,
    env:config.env?config.env:{}
  });

  const client = new Client({
    name: "demo-node-client",
    version: "1.0.0",
  });

  await client.connect(transport);
  console.log("Client connected");
  return client;
}
/**
 * url
 * bearer_token 
 * @returns 
 */
async function createRemoteClient(config){
  // 先尝试 Streamable HTTP
  try {
    const client = new Client({ name: 'node-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      // 可选：传自定义 header（如 Authorization）
      requestInit: config.bearer_token ? { headers: { Authorization: `Bearer ${config.bearer_token}` } } : undefined,
      // 也可在这里传 Cookie / X-... 等企业网关要求的头
    });
    await client.connect(transport);
    console.log('✅ Connected via Streamable HTTP');
    //const tools = await client.listTools();
    //console.log('Tools:', tools.tools.map(t => t.name));
    return client;
  } catch (err) {
    console.warn('Streamable HTTP failed, fallback to SSE...', err?.message);
  }

  // 回退到 SSE（老服务或未升级的实现）
  const client = new Client({ name: 'node-client-sse', version: '1.0.0' });
  const sse = new SSEClientTransport(new URL(config.url), {
    requestInit: config.bearer_token ? { headers: { Authorization: `Bearer ${config.bearer_token}` } } : undefined,
  });

  
  await client.connect(sse);
  console.log('✅ Connected via SSE');
  //const tools = await client.listTools();
  //console.log('Tools:', tools.tools.map(t => t.name));
  return client;
}
/**
 * 创建需要登录的远程客户端
 * @param {} config 
 */
async function createRemoteOauthClient(config){
  //console.log("createRemoteOauthClient",config);
  const issuer = config.issuer; //'https://radar.mcp.cloudflare.com';
  const client = new OauthClient({ name: 'radar-demo', version: '1.0.0' });
  const transport = new OauthStreamableHTTPClientTransport(config.url, {
    oauth: {
      issuer,
      redirectUri: 'http://127.0.0.1:53175/callback',
      tokenStorePath: getMcpOauthTokensPath(),
      clientName: 'demo-radar-auto-reg',
      debug: true
    }
      
  });

  await client.connect(transport);             // 需要登录时会自动拉起浏览器
  //console.log('Radar tools:', await client.listTools());
  return client;
}
/**
 * 查询启用状态的的 MCP 配置
 */
function loadEnableMCPConfigs(){
  let allMCPs = {
      count: 0,
      mcpServers: {}
  };
  for (const key in mcpConfig.mcpServers) {
       let config = mcpConfig.mcpServers[key]; 
       if(!config.disable){
          allMCPs.mcpServers[key] = config;
          allMCPs.count++;
       }
       
  }
  return allMCPs;
}

let allMCPClients = {};
let enabledMCPs = loadEnableMCPConfigs().mcpServers;
//console.log("Enabled MCPs:", enabledMCPs);
for (const key in enabledMCPs) {
    let config = enabledMCPs[key];
    //console.log("Creating MCP client for:", key);
    //如果是远程 MCP
    if(config.issuer&&config.url){
        allMCPClients[key] = await createRemoteOauthClient(config);
    }else if (config.url) {
        allMCPClients[key] = await createRemoteClient(config);
    }else{
        allMCPClients[key] = await createLocalClient(config);
    }
}

//创建本地连接
//let client = await createLocalClient();
function getMCPClient(name) {
  return allMCPClients[name];
}
function getMCPNameMethod(method){
    let  res = {
      name:"",
      method:"",
      mcpClient:""
    }
    res.name   = method.split("_")[0];
    res.method = method.substring(res.name.length + 1);
    //console.log(res.name);
    res.mcpClient = getMCPClient(res.name);
    //console.log(">>"+res.mcpClient);
    return res;
}


// 用户实现：统一请求处理器（返回值作为 result，抛错则作为 error）
export async function handle(methodfull, params, id, socket ) {
  try {
      logger.debug("Handling request:" + JSON.stringify({ methodfull, params, id }));
      let {mcpClient,method} = getMCPNameMethod(methodfull);
      if (method === 'initialize'){
        //新版本已经在 await client.connect(transport); 完成协商，不需要处理
        //这里是可以通过 
        if(mcpClient._initializeInfo){
          return mcpClient._initializeInfo;
        }else if (mcpClient.initialize){
          return await mcpClient.initialize({
                  clientInfo: {
                    name: 'my-client',
                    version: '0.1.0',
                  },
                  capabilities: {
                    tools: true,
                    resources: true,
                    logging: false,
                  },
                });
        }else{
          let initialize = {
              //不知道怎么获取
              "protocolVersion":mcpClient.transport.protocolVersion?mcpClient.transport.protocolVersion:"2025-03-26",
              "serverInfo": mcpClient.getServerVersion(),
              "capabilities": mcpClient.getServerCapabilities(),
              "instructions": mcpClient["_instructions"]? mcpClient["_instructions"]:""
          };
          //console.log("Initialize1:", JSON.stringify(initialize, null, 2));
          return initialize;
        }
        
      } 

      if (method === 'list') {
        let tools = await mcpClient.listTools();
        //console.log("Tools:", JSON.stringify(tools, null, 2));
        return tools;
      };
      if (method === 'call') {
        let result = await mcpClient.callTool({ name: params?.name, arguments: params?.arguments });
        //console.log("Call result:", JSON.stringify(result, null, 2));
        return result;
      }
      throw new Error(`Method not found: ${method}`);

  } catch (error) {
      logger.error(" McpServer 处理方法异常 " + methodfull + error);
  }

  
}

const respond = (sock, id, result, error) => {
  const msg = { jsonrpc: '2.0', id: id ?? null };
  error ? (msg.error = { code: -32000, message: String(error) })
        : (msg.result = result);
  sock.write(JSON.stringify(msg) + '\n');
};

export function startMCPServerProxy(){
   let start = false
   for(const key in mcpConfig.mcpServers){
        if(key){
          start =true;
          break;
        }
    }

  if(!start){
    console.log("当前没有配置 MCP Server ，无需启动代理服务。");
    return;
  }  

   const rpcserver = net.createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk;
      for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        //console.log("Received line:", line);
        if (!line) continue;

        let req;
        try { req = JSON.parse(line); }
        catch { return respond(socket, null, null, 'Parse error: invalid JSON'); }

        const { jsonrpc, id, method, params } = req ?? {};
        if (jsonrpc !== '2.0' || typeof method !== 'string' || !('id' in (req ?? {}))) {
          return respond(socket, ('id' in (req ?? {})) ? id : null, null, 'Invalid JSON-RPC request');
        }

        Promise.resolve(handle(req.method, req.params, req.id, socket))
          .then((res) => respond(socket, id, res))
          .catch((err) => respond(socket, id, null, err?.message || err));
      }
    });
    socket.on('error', () => {});
  });
  
  //如果已经存在删除
  if (fs.existsSync(PIPE_PATH)){
      fs.unlinkSync(PIPE_PATH);
  }

  rpcserver.listen(PIPE_PATH, () => {
    console.log('JSON-RPC server listening on', PIPE_PATH);
    logger.debug('JSON-RPC server listening on' + PIPE_PATH);
  });
  
}

function main() {
  console.log('Starting MCP Server Proxy...');
  startMCPServerProxy();
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

  return isDirectRun && !isChildProcess;
}

//if(isMainModule()){
 // main();
//}