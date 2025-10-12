import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import LogManager from './logger-manager.js';

const logger = LogManager.getSystemLogger();

async function testSupabaseMCP() {
  try {
    logger.debug('Testing Supabase MCP connection...');
    
    const client = new Client({ name: 'supabase-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://mcp.supabase.com/mcp'), {
      requestInit: { 
        headers: { 
          Authorization: `Bearer sbp_75d326e31e6cc3d152fc1b4132755cf79e21f434` 
        } 
      }
    });
    
    logger.debug('Connecting to Supabase MCP...');
    await client.connect(transport);
    logger.debug('✅ Connected successfully');
    
    logger.debug('Listing tools...');
    const tools = await client.listTools();
    logger.debug('Raw tools response:', JSON.stringify(tools, null, 2));
    
    if (tools && tools.tools) {
      logger.debug(`Found ${tools.tools.length} tools:`);
      tools.tools.forEach((tool, index) => {
        logger.debug(`${index + 1}. ${tool.name}: ${tool.description || 'No description'}`);
      });
    } else {
      logger.debug('No tools found or unexpected response format');
    }
    
  } catch (error) {
    logger.error('Error testing Supabase MCP:', error);
  }
}

testSupabaseMCP();