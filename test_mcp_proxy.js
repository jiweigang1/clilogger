import { spawn } from 'child_process';
import JsonRpcClient from './codex/mcpclient.js';

async function testMCPProxy() {
  console.log('Starting MCP proxy server test...');
  
  // Start the MCP proxy server
  const proxyProcess = spawn('node', ['codex/mcpserverproxy.js', '--mcpServerName=supabase'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  proxyProcess.stderr.on('data', (data) => {
    console.error('Proxy stderr:', data.toString());
  });
  
  proxyProcess.stdout.on('data', (data) => {
    console.log('Proxy stdout:', data.toString());
  });
  
  // Wait a bit for the server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    console.log('Creating JSON-RPC client...');
    const client = new JsonRpcClient();
    
    console.log('Testing initialize...');
    const initResult = await client.call('supabase_initialize');
    console.log('Initialize result:', JSON.stringify(initResult, null, 2));
    
    console.log('Testing list tools...');
    const toolsResult = await client.call('supabase_list');
    console.log('Tools result:', JSON.stringify(toolsResult, null, 2));
    
    if (toolsResult && toolsResult.tools) {
      console.log(`Found ${toolsResult.tools.length} tools via proxy`);
    } else {
      console.log('No tools found via proxy or unexpected format');
    }
    
  } catch (error) {
    console.error('Error testing MCP proxy:', error);
  } finally {
    proxyProcess.kill();
  }
}

testMCPProxy();