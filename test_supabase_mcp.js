import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testSupabaseMCP() {
  try {
    console.log('Testing Supabase MCP connection...');
    
    const client = new Client({ name: 'supabase-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://mcp.supabase.com/mcp'), {
      requestInit: { 
        headers: { 
          Authorization: `Bearer sbp_75d326e31e6cc3d152fc1b4132755cf79e21f434` 
        } 
      }
    });
    
    console.log('Connecting to Supabase MCP...');
    await client.connect(transport);
    console.log('✅ Connected successfully');
    
    console.log('Listing tools...');
    const tools = await client.listTools();
    console.log('Raw tools response:', JSON.stringify(tools, null, 2));
    
    if (tools && tools.tools) {
      console.log(`Found ${tools.tools.length} tools:`);
      tools.tools.forEach((tool, index) => {
        console.log(`${index + 1}. ${tool.name}: ${tool.description || 'No description'}`);
      });
    } else {
      console.log('No tools found or unexpected response format');
    }
    
  } catch (error) {
    console.error('Error testing Supabase MCP:', error);
  }
}

testSupabaseMCP();