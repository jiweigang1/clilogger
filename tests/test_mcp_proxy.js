import { spawn } from 'child_process';
import JsonRpcClient from '../codex/mcpclient.js';
import LogManager from '../logger-manager.js';

const logger = LogManager.getSystemLogger();

async function testMCPProxy() {
  logger.debug('Starting MCP proxy server test...');
  
  // Start the MCP proxy server
  const proxyProcess = spawn('node', ['../codex/mcpserverproxy.js', '--mcpServerName=supabase'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  proxyProcess.stderr.on('data', (data) => {
    logger.error('Proxy stderr:', data.toString());
  });
  
  proxyProcess.stdout.on('data', (data) => {
    logger.debug('Proxy stdout:', data.toString());
  });
  
  // Wait a bit for the server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    logger.debug('Creating JSON-RPC client...');
    const client = new JsonRpcClient();
    
    logger.debug('Testing initialize...');
    const initResult = await client.call('supabase_initialize');
    logger.debug('Initialize result:', JSON.stringify(initResult, null, 2));
    
    logger.debug('Testing list tools...');
    const toolsResult = await client.call('supabase_list');
    logger.debug('Tools result:', JSON.stringify(toolsResult, null, 2));
    
    if (toolsResult && toolsResult.tools) {
      logger.debug(`Found ${toolsResult.tools.length} tools via proxy`);
    } else {
      logger.debug('No tools found via proxy or unexpected format');
    }
    
  } catch (error) {
    console.error('Error testing MCP proxy:', error);
  } finally {
    proxyProcess.kill();
  }
}

testMCPProxy();