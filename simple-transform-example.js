// Simple example of using transformResponseIn with streaming data
import AnthropicTransformer from './anthropic-transformer.js';

// Example streaming response data (like the one you provided)
const exampleStreamData = [
  'event: response.created\ndata: {"id":"resp_abc123","type":"response.created","created":1739558401,"response":{"id":"resp_abc123","model":"gpt-4o-mini","status":"in_progress"}}\n\n',
  'event: response.in_progress\ndata: {"id":"resp_abc123","type":"response.in_progress","response":{"id":"resp_abc123","status":"in_progress"}}\n\n',
  'event: response.output_text.delta\ndata: {"id":"resp_abc123","type":"response.output_text.delta","response_id":"resp_abc123","output_index":0,"delta":"早"}\n\n',
  'event: response.output_text.delta\ndata: {"id":"resp_abc123","type":"response.output_text.delta","response_id":"resp_abc123","output_index":0,"delta":"上"}\n\n',
  'event: response.output_text.delta\ndata: {"id":"resp_abc123","type":"response.output_text.delta","response_id":"resp_abc123","output_index":0,"delta":"好，"}\n\n',
  'event: response.output_text.delta\ndata: {"id":"resp_abc123","type":"response.output_text.delta","response_id":"resp_abc123","output_index":0,"delta":"给你一段流式返回示例。"}\n\n',
  'event: response.output_text.done\ndata: {"id":"resp_abc123","type":"response.output_text.done","response_id":"resp_abc123","output_index":0}\n\n'
];

// Simple method to transform streaming response data
async function transformResponseIn(streamData) {
  const transformer = new AnthropicTransformer();

  // Create a mock Response object with a readable stream
  const stream = new ReadableStream({
    start(controller) {
      // Simulate streaming by sending data chunks with delays
      let index = 0;
      const encoder = new TextEncoder();

      const sendNextChunk = () => {
        if (index < streamData.length) {
          controller.enqueue(encoder.encode(streamData[index]));
          index++;
          setTimeout(sendNextChunk, 100); // Simulate network delay
        } else {
          controller.close();
        }
      };

      sendNextChunk();
    }
  });

  // Create a Response object that mimics the actual streaming response
  const mockResponse = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });

  try {
    // Use the existing transformResponseIn method
    const transformedResponse = await transformer.transformResponseIn(mockResponse);

    // Process the transformed stream
    const reader = transformedResponse.body.getReader();
    const decoder = new TextDecoder();

    console.log('Transformed Anthropic-style streaming response:');
    console.log('==============================================');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const eventType = line.replace('event:', '').trim();
          console.log(`Event: ${eventType}`);
        } else if (line.startsWith('data:')) {
          const data = line.replace('data:', '').trim();
          try {
            const parsedData = JSON.parse(data);
            console.log('Data:', JSON.stringify(parsedData, null, 2));
          } catch (e) {
            console.log('Data:', data);
          }
        }
      }
    }

    return transformedResponse;
  } catch (error) {
    console.error('Error transforming response:', error);
    throw error;
  }
}

// Even simpler method for direct data transformation
function simpleTransformResponse(data) {
  // Convert the streaming data to Anthropic format
  const anthropicEvents = [];
  let messageId = `msg_${Date.now()}`;
  let contentIndex = 0;
  let accumulatedText = '';

  // Simulate message start
  anthropicEvents.push({
    event: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'gpt-4o-mini',
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      }
    }
  });

  // Process text content
  for (const item of data) {
    if (item.includes('response.output_text.delta')) {
      const match = item.match(/"delta":"([^"]*)"/);
      if (match) {
        accumulatedText += match[1];
      }
    }
  }

  // Add content block
  anthropicEvents.push({
    event: 'content_block_start',
    data: {
      type: 'content_block_start',
      index: contentIndex,
      content_block: {
        type: 'text',
        text: ''
      }
    }
  });

  // Add the accumulated text
  anthropicEvents.push({
    event: 'content_block_delta',
    data: {
      type: 'content_block_delta',
      index: contentIndex,
      delta: {
        type: 'text_delta',
        text: accumulatedText
      }
    }
  });

  // Close content block
  anthropicEvents.push({
    event: 'content_block_stop',
    data: {
      type: 'content_block_stop',
      index: contentIndex
    }
  });

  // Message delta and stop
  anthropicEvents.push({
    event: 'message_delta',
    data: {
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null
      },
      usage: {
        input_tokens: 10,
        output_tokens: accumulatedText.length,
        cache_read_input_tokens: 0
      }
    }
  });

  anthropicEvents.push({
    event: 'message_stop',
    data: {
      type: 'message_stop'
    }
  });

  return anthropicEvents;
}

// Usage examples
async function runExamples() {
  console.log('=== Simple Transform Example ===');
  const simpleResult = simpleTransformResponse(exampleStreamData);
  simpleResult.forEach(event => {
    console.log(`${event.event}:`, JSON.stringify(event.data, null, 2));
  });

  console.log('\n=== Full Transform Example ===');
  try {
    await transformResponseIn(exampleStreamData);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Export the functions
export { transformResponseIn, simpleTransformResponse, runExamples };

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}