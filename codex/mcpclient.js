import net from 'node:net';

const PIPE_PATH = '\\\\.\\pipe\\jsonrpc';

export default class JsonRpcClient {
  constructor() {
    this.socket = net.createConnection(PIPE_PATH);
    this.nextId = 1;
    this.pending = new Map();
    let buf = '';

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

    this.socket.on('error', (e) => {
      for (const [, p] of this.pending) p.reject(e);
      this.pending.clear();
    });
  }

  call(method, params) {
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
    console.log('ping =>', await cli.call('ping'));
    console.log('echo =>', await cli.call('echo', 'hello'));
    console.log('add  =>', await cli.call('add', [1, 2]));
  } catch (e) {
    console.error('RPC error:', e.message);
  } finally {
    setTimeout(() => process.exit(0), 200);
  }
})();
*/
