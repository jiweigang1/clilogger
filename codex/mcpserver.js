/**
 * 代理 MCP 服务是可以单独进行的，理论上一台机器只需要启动一个代理进程，便可以处理来自多个客户端的请求。
 * 但是如果主进程关闭，代理进程也会随之关闭。
 */
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

const PIPE_PATH = await getPipePath();
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
  logger.debug("Client connected");
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
    logger.debug('✅ Connected via Streamable HTTP');
    //const tools = await client.listTools();
    //console.log('Tools:', tools.tools.map(t => t.name));
    return client;
  } catch (err) {
    logger.debug('Streamable HTTP failed, fallback to SSE...', err?.message);
  }

  // 回退到 SSE（老服务或未升级的实现）
  const client = new Client({ name: 'node-client-sse', version: '1.0.0' });
  const sse = new SSEClientTransport(new URL(config.url), {
    requestInit: config.bearer_token ? { headers: { Authorization: `Bearer ${config.bearer_token}` } } : undefined,
  });

  
  await client.connect(sse);
  logger.debug('✅ Connected via SSE');
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

/**
 * 过滤和改写 tools
 * @param {string} mcpName - MCP 服务名称
 * @param {Array} tools - 原始 tools 列表
 * @returns {Array} - 过滤和改写后的 tools 列表
 */
function filterAndRewriteTools(mcpName, tools) {
  const config = mcpConfig.mcpServers[mcpName];
  if (!config || !config.tools) {
    return tools;
  }

  let filteredTools = tools;

  // 应用黑名单过滤
  if (config.tools.blacklist && Array.isArray(config.tools.blacklist)) {
    filteredTools = tools.filter(tool => 
      !config.tools.blacklist.includes(tool.name)
    );
  }

  // 应用描述改写
  if (config.tools.descriptions && typeof config.tools.descriptions === 'object') {
    filteredTools = filteredTools.map(tool => {
      if (config.tools.descriptions[tool.name]) {
        return {
          ...tool,
          description: config.tools.descriptions[tool.name]
        };
      }
      return tool;
    });
  }

  return filteredTools;
}

let allMCPClients = {};
let allMCPConfigs = {};
let enabledMCPs = loadEnableMCPConfigs().mcpServers;
//console.log("Enabled MCPs:", enabledMCPs);

// 只保存配置，不立即连接
for (const key in enabledMCPs) {
    allMCPConfigs[key] = enabledMCPs[key];
    // 初始化客户端为null，表示未连接
    allMCPClients[key] = null;
}

//创建本地连接
//let client = await createLocalClient();

/**
 * 懒加载MCP客户端
 * 如果客户端未连接，则根据配置创建连接
 * @param {string} name - MCP服务名称
 * @returns {Promise<object>} - 返回连接的客户端
 */
async function getOrCreateMCPClient(name) {
  // 如果客户端已存在且已连接，直接返回
  if (allMCPClients[name]) {
    return allMCPClients[name];
  }

  // 获取配置
  const config = allMCPConfigs[name];
  if (!config) {
    logger.error("MCP configuration not found for: " + name);
    return null;
  }

  logger.debug(`懒加载创建MCP客户端: ${name}`);

  try {
    // 根据配置类型创建客户端
    if(config.issuer&&config.url){
      allMCPClients[name] = await createRemoteOauthClient(config);
    }else if (config.url) {
      allMCPClients[name] = await createRemoteClient(config);
    }else{
      allMCPClients[name] = await createLocalClient(config);
    }

    logger.debug(`MCP客户端创建成功: ${name}`);
    return allMCPClients[name];
  } catch (error) {
    logger.error(`创建MCP客户端失败 ${name}:`, error);
    throw error;
  }
}

function getMCPClient(name) {
  return allMCPClients[name];
}
function getMCPNameMethod(method){
    let  res = {
      //MCP 服务名称
      name:"",
      //Tool 方法名称
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
      logger.debug(" mcpserver Handling request:" + JSON.stringify({ methodfull, params, id }));
      let {name, mcpClient,method} = getMCPNameMethod(methodfull);

      // 使用懒加载获取客户端
      if(!mcpClient){
        logger.debug(`MCP Client not found for: ${name}, attempting lazy load...`);
        try {
          mcpClient = await getOrCreateMCPClient(name);
          if (!mcpClient) {
            logger.error("MCP Client creation failed for: " + name);
            throw new Error(`McpServer not found: ${name}`);
          }
        } catch (error) {
          logger.error(`Failed to create MCP client for ${name}:`, error);
          throw new Error(`Failed to connect to MCP server: ${name} - ${error.message}`);
        }
      }

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
        // 应用黑名单过滤和描述改写
        if (tools && tools.tools) {
          tools.tools = filterAndRewriteTools(name, tools.tools);
        }
        logger.debug("Tools:" + JSON.stringify(tools, null, 2));
        return tools;
      };
      if (method === 'call') {
        let result = await mcpClient.callTool({ name: params?.name, arguments: params?.arguments });
        //console.log("Call result:", JSON.stringify(result, null, 2));
        return result;
      }
      throw new Error(`McpServer Method not found: ${method}`);

}

const respond = (sock, id, result, error) => {
  const msg = { jsonrpc: '2.0', id: id ?? null };
  error ? (msg.error = { code: -32000, message: String(error) }) : (msg.result = result);
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
    logger.debug("当前没有配置 MCP Server ，无需启动代理服务。");
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
      try {
        fs.unlinkSync(PIPE_PATH);
      } catch (error) {
        logger.debug('无法删除已存在的管道文件，可能正在被使用:', error.message);
      }
  }

  rpcserver.listen(PIPE_PATH, () => {
    logger.debug('JSON-RPC server listening on', PIPE_PATH);
  });
  
}

function main() {
  logger.debug('Starting MCP Server Proxy...');
  startMCPServerProxy();
}

//main();
