/** 
prompt 

生成一个方法使用 nodejs JavaScript 语言，其可以把  OpenAI Responses 响应合并成一个完整的相应 JSON，方法入参为 events ，events  是一个文本数组，数据每一个元素是一个 event 原始文本
用以下测试数据，生成测试例子

event: response.created
data: {"type":"response.created","response":{"id":"resp_67c9fdcecf488190bdd9a0409de3a1ec07b8b0ad4e5eb654","object":"response","created_at":1741290958,"status":"in_progress","error":null,"incomplete_details":null,"instructions":"你是一个有帮助的助手。","max_output_tokens":null,"model":"gpt-4.1-2025-04-14","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":1.0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1.0,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}

event: response.in_progress
data: {"type":"response.in_progress","response":{"id":"resp_67c9fdcecf488190bdd9a0409de3a1ec07b8b0ad4e5eb654","object":"response","created_at":1741290958,"status":"in_progress","error":null,"incomplete_details":null,"instructions":"你是一个有帮助的助手。","max_output_tokens":null,"model":"gpt-4.1-2025-04-14","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":1.0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1.0,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}

event: response.output_item.added
data: {"type":"response.output_item.added","output_index":0,"item":{"id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","type":"message","status":"in_progress","role":"assistant","content":[]}}

event: response.content_part.added
data: {"type":"response.content_part.added","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"你好"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"！"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":" 我"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"能"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"为"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"您"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"提供"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"什么"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"帮助"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"吗"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"？"}

event: response.output_text.done
data: {"type":"response.output_text.done","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"text":"你好！ 我能为您提供什么帮助吗？"}

event: response.content_part.done
data: {"type":"response.content_part.done","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"part":{"type":"output_text","text":"你好！ 我能为您提供什么帮助吗？","annotations":[]}}

event: response.output_item.done
data: {"type":"response.output_item.done","output_index":0,"item":{"id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"你好！ 我能为您提供什么帮助吗？","annotations":[]}]}}

event: response.completed
data: {"type":"response.completed","response":{"id":"resp_67c9fdcecf488190bdd9a0409de3a1ec07b8b0ad4e5eb654","object":"response","created_at":1741290958,"status":"completed","error":null,"incomplete_details":null,"instructions":"你是一个有帮助的助手。","max_output_tokens":null,"model":"gpt-4.1-2025-04-14","output":[{"id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"你好！ 我能为您提供什么帮助吗？","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":1.0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1.0,"truncation":"disabled","usage":{"input_tokens":37,"output_tokens":11,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":48},"user":null,"metadata":{}}}

/**
 prompt 

生成一个方法使用 nodejs JavaScript 语言，其可以把  Chat Completions API  流式响应合并成一个完整的相应 JSON，方法入参为 events ，events  是一个文本数组，数据每一个元素是一个 event 原始文本
生成测试例子


以下为测试响应数据
{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini", "system_fingerprint": "fp_44709d6fcb", "choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}]}

{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini", "system_fingerprint": "fp_44709d6fcb", "choices":[{"index":0,"delta":{"content":"Hello"},"logprobs":null,"finish_reason":null}]}

....

{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini", "system_fingerprint": "fp_44709d6fcb", "choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}


 
 */
async function  readAll(reader){
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
      const { done, value } = await reader.read();
      if(value){
        buffer += decoder.decode(value, { stream: true });
      }
      if (done) {
          break;
      }
  }
  return buffer;
}

/**
 * 通过流进行读取
 * 这个流最好是 fork 的一份，不要影响输出
 */
export async function  parseOpenAIResponse(reader){
  const buffer = await readAll(reader);
  return _parseResponseObject(buffer);
}

/**
 * 直接转换所有文本
 */
function _parseResponseObject(body){
   return mergeOpenAIResponseEvents(body.split('\n\n'));
}

/**
 * 将 OpenAI Responses SSE 事件合并为一个完整的响应 JSON
 * @param {string[]} events - 每个元素是一段原始事件文本（通常包含 "event: ..." 和 "data: {...}"）
 * @returns {object} 合并后的响应对象
 */
export function mergeOpenAIResponseEvents(events) {
  // 内部状态
  const items = new Map(); // item_id -> { ...item, content:[{...}] }
  let latestResponseObj = null; // 最近一次出现于 response.* 的 response 对象
  let completedResponseObj = null; // response.completed 的 response 对象（若出现则直接返回）

  // 工具：从一段原始事件文本里取出 JSON（data: ...）
  function parseEventBlock(raw) {
    if (typeof raw !== 'string') return null;
    // SSE 事件通常是多行，data: 后面可能就是 JSON
    // 也允许 raw 就是纯 JSON 字符串（兼容性）
    const dataLine = raw
      .split(/\r?\n/)
      .map(s => s.trim())
      .find(line => line.startsWith('data:'));
    const jsonText = dataLine ? dataLine.slice('data:'.length).trim() : raw.trim();
    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }

  // 确保 item 与 content 索引存在
  function ensureItemContent(itemId, contentIndex) {
    if (!items.has(itemId)) {
      items.set(itemId, { id: itemId, type: 'message', status: 'in_progress', role: 'assistant', content: [] });
    }
    const it = items.get(itemId);
    while (it.content.length <= contentIndex) {
      it.content.push({ type: 'output_text', text: '', annotations: [] });
    }
    return it;
  }

  for (const raw of events) {
    const data = parseEventBlock(raw);
    if (!data || !data.type) continue;

    switch (data.type) {
      case 'response.created':
      case 'response.in_progress':
        if (data.response) latestResponseObj = data.response;
        break;

      case 'response.output_item.added': {
        const { item, output_index } = data;
        if (item && item.id) {
          // 以服务端给的 item 为准
          items.set(item.id, JSON.parse(JSON.stringify(item)));
          // 但为安全起见，若没有 content 初始化为 []
          if (!Array.isArray(items.get(item.id).content)) {
            items.get(item.id).content = [];
          }
          // output_index 暂未直接使用；所有内容通过 item_id/content_index 关联
        }
        break;
      }

      case 'response.content_part.added': {
        const { item_id, content_index, part } = data;
        if (item_id != null && content_index != null && part) {
          const it = ensureItemContent(item_id, content_index);
          // 如果是 output_text，确保有 text/annotations
          if (part.type === 'output_text') {
            it.content[content_index] = {
              type: 'output_text',
              text: part.text || '',
              annotations: Array.isArray(part.annotations) ? part.annotations : []
            };
          } else {
            // 其它类型按原样塞进去
            it.content[content_index] = part;
          }
        }
        break;
      }

      case 'response.output_text.delta': {
        const { item_id, content_index, delta } = data;
        if (item_id != null && content_index != null && typeof delta === 'string') {
          const it = ensureItemContent(item_id, content_index);
          const part = it.content[content_index];
          if (part && part.type === 'output_text') {
            part.text = (part.text || '') + delta;
          } else {
            // 若不是 output_text，强制转为 output_text 累加（保底）
            it.content[content_index] = {
              type: 'output_text',
              text: (part && part.text ? part.text : '') + delta,
              annotations: (part && Array.isArray(part.annotations)) ? part.annotations : []
            };
          }
        }
        break;
      }

      case 'response.output_text.done': {
        const { item_id, content_index, text } = data;
        if (item_id != null && content_index != null) {
          const it = ensureItemContent(item_id, content_index);
          const part = it.content[content_index] || { type: 'output_text', text: '', annotations: [] };
          // 以 done 提供的最终文本为准（一般与 delta 累计一致）
          it.content[content_index] = {
            ...part,
            type: 'output_text',
            text: typeof text === 'string' ? text : (part.text || ''),
          };
        }
        break;
      }

      case 'response.content_part.done': {
        const { item_id, content_index, part } = data;
        if (item_id != null && content_index != null && part) {
          const it = ensureItemContent(item_id, content_index);
          // 用最终的 part 覆盖（可能带 annotations）
          it.content[content_index] = {
            type: part.type || 'output_text',
            text: part.text || (it.content[content_index]?.text ?? ''),
            annotations: Array.isArray(part.annotations) ? part.annotations : (it.content[content_index]?.annotations ?? [])
          };
        }
        break;
      }

      case 'response.output_item.done': {
        const { item } = data;
        if (item && item.id) {
          // 用服务端最终 item 覆盖，但如果我们本地已累计了文本，把本地 content 合并进去（避免丢增量）
          const local = items.get(item.id);
          const merged = JSON.parse(JSON.stringify(item));
          if (local && Array.isArray(local.content) && local.content.length) {
            merged.content = local.content;
          }
          items.set(item.id, merged);
        }
        break;
      }

      case 'response.completed':
        if (data.response) {
          completedResponseObj = data.response;
          latestResponseObj = data.response;
        }
        break;

      default:
        // 其它类型（如 tool 调用等）可以在此扩展
        break;
    }
  }

  // 若已经拿到服务端的最终 completed 响应，直接返回它
  if (completedResponseObj) {
    // 保险起见，将我们积累的 items 覆写到 response.output（若 output 是 message 们）
    try {
      const resp = JSON.parse(JSON.stringify(completedResponseObj));
      if (Array.isArray(resp.output)) {
        // 将同 id 的内容替换为累积版本
        const byId = new Map(resp.output.map(o => [o.id, o]));
        for (const [id, it] of items.entries()) {
          if (byId.has(id)) byId.set(id, it);
          else byId.set(id, it);
        }
        resp.output = Array.from(byId.values());
      } else if (items.size) {
        resp.output = Array.from(items.values());
      }
      return resp;
    } catch {
      return completedResponseObj;
    }
  }

  // 否则：合成一个尽可能完整的响应对象（基于 latestResponseObj 或最小骨架）
  const synthetic = latestResponseObj
    ? JSON.parse(JSON.stringify(latestResponseObj))
    : {
        id: null,
        object: 'response',
        created_at: Math.floor(Date.now() / 1000),
        status: 'in_progress',
        output: [],
      };

  // 用我们累积到的 items 作为 output
  synthetic.output = Array.from(items.values());

  // 如果没有状态但看起来文本已结束，设置为 completed
  const hasAnyText = synthetic.output.some(
    it => Array.isArray(it.content) && it.content.some(p => p?.type === 'output_text' && p.text && p.text.length > 0)
  );
  if (synthetic.status === 'in_progress' && hasAnyText) {
    // 不武断改状态，保留 in_progress；如需可改为 'completed'
    // synthetic.status = 'completed';
  }

  return synthetic;
}

/* ------------------------- 测试用例（你的示例数据） ------------------------- */

const testEvents = [
`event: response.created
data: {"type":"response.created","response":{"id":"resp_67c9fdcecf488190bdd9a0409de3a1ec07b8b0ad4e5eb654","object":"response","created_at":1741290958,"status":"in_progress","error":null,"incomplete_details":null,"instructions":"你是一个有帮助的助手。","max_output_tokens":null,"model":"gpt-4.1-2025-04-14","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":1.0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1.0,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}
`,

`event: response.in_progress
data: {"type":"response.in_progress","response":{"id":"resp_67c9fdcecf488190bdd9a0409de3a1ec07b8b0ad4e5eb654","object":"response","created_at":1741290958,"status":"in_progress","error":null,"incomplete_details":null,"instructions":"你是一个有帮助的助手。","max_output_tokens":null,"model":"gpt-4.1-2025-04-14","output":[],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":1.0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1.0,"truncation":"disabled","usage":null,"user":null,"metadata":{}}}
`,

`event: response.output_item.added
data: {"type":"response.output_item.added","output_index":0,"item":{"id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","type":"message","status":"in_progress","role":"assistant","content":[]}}
`,

`event: response.content_part.added
data: {"type":"response.content_part.added","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"你好"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"！"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":" 我"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"能"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"为"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"您"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"提供"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"什么"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"帮助"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"吗"}
`,

`event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"delta":"？"}
`,

`event: response.output_text.done
data: {"type":"response.output_text.done","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"text":"你好！ 我能为您提供什么帮助吗？"}
`,

`event: response.content_part.done
data: {"type":"response.content_part.done","item_id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","output_index":0,"content_index":0,"part":{"type":"output_text","text":"你好！ 我能为您提供什么帮助吗？","annotations":[]}}
`,

`event: response.output_item.done
data: {"type":"response.output_item.done","output_index":0,"item":{"id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"你好！ 我能为您提供什么帮助吗？","annotations":[]}]}}
`,

`event: response.completed
data: {"type":"response.completed","response":{"id":"resp_67c9fdcecf488190bdd9a0409de3a1ec07b8b0ad4e5eb654","object":"response","created_at":1741290958,"status":"completed","error":null,"incomplete_details":null,"instructions":"你是一个有帮助的助手。","max_output_tokens":null,"model":"gpt-4.1-2025-04-14","output":[{"id":"msg_67c9fdcf37fc8190ba82116e33fb28c507b8b0ad4e5eb654","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"你好！ 我能为您提供什么帮助吗？","annotations":[]}]}],"parallel_tool_calls":true,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":1.0,"text":{"format":{"type":"text"}},"tool_choice":"auto","tools":[],"top_p":1.0,"truncation":"disabled","usage":{"input_tokens":37,"output_tokens":11,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":48},"user":null,"metadata":{}}}
`,
];

// 运行合并并打印结果
const merged = mergeOpenAIResponseEvents(testEvents);
//console.log(JSON.stringify(merged, null, 2));

// 如果你只想拿到纯文本（例如第一条 message 的 output_text）
const firstMsg = Array.isArray(merged.output) ? merged.output[0] : null;
const text = firstMsg?.content?.find?.(p => p.type === 'output_text')?.text ?? '';
//console.log('--- Extracted Text ---\n' + text);




/**
 * 通过流进行读取
 * 这个流最好是 fork 的一份，不要影响输出
 */
export async function  parseOpenAIChatCompletion(reader){
  const buffer = await readAll(reader);
  return _parseOpenAIChatCompletion(buffer);
}

/**
 * 直接转换所有文本
 */
function _parseOpenAIChatCompletion(body){
   return mergeOpenAIChatCompletionEvents(body.split('\n\n'));
}




/**
 *
 * 合并 Chat Completions API 流式分片为完整响应。
 * @param {string[]} events - 每个元素是一个 event 的原始文本（通常是一行 JSON 字符串；若带 "data: " 前缀也能处理）
 * @returns {object} - 近似非流式的 chat.completion 响应对象
 */
function mergeOpenAIChatCompletionEvents(events) {
  const acc = {
    id: null,
    object: "chat.completion",
    created: null,
    model: null,
    system_fingerprint: null,
    choices: [], // index 对应 choices 的 index
  };

  // 用于 choices 按 index 累积
  const choiceMap = new Map();

  const parseMaybeJSON = (line) => {
    if (!line || !line.trim()) return null;
    const cleaned = line.trim().startsWith("data:")
      ? line.trim().slice(5).trim()
      : line.trim();
    if (!cleaned || cleaned === "[DONE]") return null;
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  };

  for (const raw of events) {
    const chunk = parseMaybeJSON(raw);
    if (!chunk || chunk.object !== "chat.completion.chunk") continue;

    // 顶层元信息以「第一次出现」为准（大多数情况下都一致）
    if (acc.id === null) acc.id = chunk.id ?? null;
    if (acc.created === null) acc.created = chunk.created ?? null;
    if (acc.model === null) acc.model = chunk.model ?? null;
    if (acc.system_fingerprint === null) {
      acc.system_fingerprint = chunk.system_fingerprint ?? null;
    }

    // 处理 choices
    if (Array.isArray(chunk.choices)) {
      for (const ch of chunk.choices) {
        const idx = ch.index ?? 0;
        if (!choiceMap.has(idx)) {
          choiceMap.set(idx, {
            index: idx,
            message: { role: "assistant", content: "" },
            logprobs: null,
            finish_reason: null,
          });
        }
        const target = choiceMap.get(idx);

        // 累积 role / content
        const delta = ch.delta ?? {};
        if (typeof delta.role === "string") {
          target.message.role = delta.role;
        }
        if (typeof delta.content === "string") {
          target.message.content += delta.content;
        }

        // 累积 tool_calls（如果有）
        // 说明：OpenAI 流式时 tool_calls 可能分片到多个 delta 中；这里把 function.arguments 逐步拼接
        if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
          if (!Array.isArray(target.message.tool_calls)) {
            target.message.tool_calls = [];
          }
          delta.tool_calls.forEach((tc, i) => {
            // 目标位置：若已有则取已有的对应项，否则 push 新项
            const existing = target.message.tool_calls[i] ?? {
              id: tc.id ?? null,
              type: tc.type ?? "function",
              function: { name: tc.function?.name ?? "", arguments: "" },
            };
            // 更新 id / name（如果本分片提供）
            if (tc.id && !existing.id) existing.id = tc.id;
            if (tc.function?.name) existing.function.name = tc.function.name;
            // 追加 arguments 片段
            if (typeof tc.function?.arguments === "string") {
              existing.function.arguments += tc.function.arguments;
            }
            target.message.tool_calls[i] = existing;
          });
        }

        // 结束原因（通常只在最后一个分片才出现）
        if (typeof ch.finish_reason === "string" && ch.finish_reason) {
          target.finish_reason = ch.finish_reason;
        }

        // logprobs（若 API 返回）
        if (ch.logprobs != null) {
          target.logprobs = ch.logprobs;
        }
      }
    }
  }

  // 将 Map 转为数组并按 index 排序
  acc.choices = Array.from(choiceMap.values()).sort((a, b) => a.index - b.index);

  return acc;
}