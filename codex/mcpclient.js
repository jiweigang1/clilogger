import net from 'node:net';
import { getPipePath } from '../untils.js';
import LogManager from '../logger-manager.js';
const logger = LogManager.getSystemLogger();

const PIPE_PATH = await getPipePath();
logger.debug("JsonRpcClient PIPE_PATH:" + PIPE_PATH);

/**
 * 使用文件协议通信的 JSON-RPC 客户端
 */
export default class JsonRpcClient {
  constructor() {
    this.socket = net.createConnection(PIPE_PATH);
    this.nextId = 1;
    this.pending = new Map();
    this.connectionError = null;
    this.connected = false;
    this.connectionTimeout = 5000; // 5秒连接超时
    let buf = '';
    
    // 连接成功
    this.socket.on('connect', () => {
      logger.info('JSON-RPC client connected to', PIPE_PATH);
      this.connected = true;
      this.connectionError = null;
    });
    
    // 连接错误
    this.socket.on('error', (e) => {
      logger.error('JSON-RPC client connection error:', e.message);
      this.connectionError = e;
      this.connected = false;
      for (const [, p] of this.pending) p.reject(e);
      this.pending.clear();
    });
    
    // 连接关闭
    this.socket.on('close', () => {
      logger.info('JSON-RPC client connection closed');
      let con = this.connected;
      this.connected = false;
      if(con){
          this.connectionError = new Error('Connection closed');
      //如果根本没有链接过，应该是链接失败    
      }else{
          this.connectionError = new Error('Connection closed ，请检查服务是否启动');
      }
     
    });
    
    // 数据接收处理
    this.socket.on('data', (chunk) => {
      buf += chunk;
      for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
        }
      }
    });
    
  }

  // 等待连接建立或超时
  async waitForConnection() {
    if (this.connected) return;
    if (this.connectionError) throw this.connectionError;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout: Server not responding at ${PIPE_PATH}`));
      }, this.connectionTimeout);
      
      this.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.socket.once('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Connection failed: ${err.message}`));
      });
    });
  }

  async call(method, params) {
    // 检查连接状态
    await this.waitForConnection();
    
    const id = this.nextId++;
    const req = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.write(JSON.stringify(req) + '\n');
    });
  }
}

/** 
// demo
(async () => {
  const cli = new JsonRpcClient(PIPE_PATH);
  try {
    logger.debug('ping =>', await cli.call('ping'));
    logger.debug('echo =>', await cli.call('echo', 'hello'));
    logger.debug('add  =>', await cli.call('add', [1, 2]));
  } catch (e) {
    logger.error('RPC error:', e.message);
  } finally {
    setTimeout(() => process.exit(0), 200);
  }
})();
*/