import { Client, StreamableHTTPClientTransport } from './mcp-client.js';

const issuer = 'https://radar.mcp.cloudflare.com';
const client = new Client({ name: 'radar-demo', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(`${issuer}/mcp`, {

  oauth: {
    issuer,
    // 显式覆盖端点（根据你调试日志里看到的为准）
    //authorizationUrl: `${issuer}/oauth/authorize`,
    //tokenUrl:        `${issuer}/oauth/token`,
    //registrationUrl: `${issuer}/oauth/register`,

    // 先尝试动态注册；如报“no registration_endpoint”，请改为手动 clientId
    // clientId: '从门户或运维处获得',
    scopes: ['openid','profile','email','offline_access'],
    redirectUri: 'http://127.0.0.1:53175/callback',
    tokenStorePath: '.mcp_oauth_tokens.json',
    clientName: 'demo-radar-auto-reg',
    debug: true
  }
    
});


await client.connect(transport);             // 需要登录时会自动拉起浏览器
console.log('Radar tools:', await client.listTools());
