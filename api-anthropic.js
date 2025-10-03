export function mergeAnthropic(all){
   return mergeAnthropicChunks(all.split("\n"));
}
/**
 * 将 Anthropic 流式 chunk（原始字符串数组）合并为完整响应消息体。
 * 兼容 chunk 形态：
 *  - "data: {...}" 或 "{...}"
 *  - 事件类型：message_start, content_block_start, content_block_delta,
 *    content_block_stop, message_delta, message_stop, ping
 *  - 文本增量：delta.type === "text_delta", delta.text
 *  - 工具增量：delta.partial_json / delta.input_json / delta.input_json_delta
 *
 * @param {string[]} rawChunks - 原始 chunk 文本数组，每个元素是一行 SSE data。
 * @returns {{
 *   message: {
 *     id?: string,
 *     type: "message",
 *     role: "assistant",
 *     model?: string,
 *     stop_reason?: string | null,
 *     stop_sequence?: string | null,
 *     usage: { input_tokens: number, output_tokens: number },
 *     content: Array<
 *       | { type: "text", text: string }
 *       | { type: "tool_use", id: string, name: string, input: any }
 *     >
 *   },
 *   debug: { parsedCount: number, ignoredCount: number, errors: Array<{idx:number,error:string,raw:string}> }
 * }}
 */
export function mergeAnthropicChunks(rawChunks) {
  const message = {
    type: "message",
    role: "assistant",
    content: [],
    usage: { input_tokens: 0, output_tokens: 0 },
    stop_reason: null,
    stop_sequence: null,
  };

  // content block 临时态：按 index 管理；为工具输入保留 JSON 片段缓冲
  const blockMap = new Map(); // index -> { ref, toolJsonBuffer }
  const debug = { parsedCount: 0, ignoredCount: 0, errors: [] };

  const parseMaybeJson = (line) => {
    // 去掉 "data:" 前缀及空白/末尾 [DONE]
    const trimmed = line.trim();
    if (!trimmed || trimmed === "data: [DONE]") return null;
    let jsonText = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;

    if (!jsonText || jsonText === "[DONE]") return null;
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      throw new Error(`JSON parse failed: ${e.message}`);
    }
  };

  const ensureBlock = (index, starter) => {
    if (blockMap.has(index)) return blockMap.get(index);

    let ref;
    let toolJsonBuffer = "";

    if (starter?.type === "tool_use" || starter?.content_block?.type === "tool_use") {
      // 工具块
      const b = starter.type === "tool_use" ? starter : starter.content_block;
      ref = { type: "tool_use", id: b.id, name: b.name, input: {} };
      message.content.push(ref);
      const slot = { ref, toolJsonBuffer };
      blockMap.set(index, slot);
      return slot;
    } else {
      // 文本块
      ref = { type: "text", text: "" };
      message.content.push(ref);
      const slot = { ref, toolJsonBuffer };
      blockMap.set(index, slot);
      return slot;
    }
  };

  const feedToolJson = (slot, piece) => {
    // Anthropic 常见：delta.partial_json / delta.input_json 逐段拼接
    if (typeof piece === "string") {
      slot.toolJsonBuffer += piece;
      return;
    }
    // 兜底：对象/数组直接合并为字符串再解析
    try {
      slot.toolJsonBuffer += JSON.stringify(piece);
    } catch {
      slot.toolJsonBuffer += String(piece);
    }
  };

  const finalizeToolInputIfAny = (slot) => {
    if (!slot || slot.ref?.type !== "tool_use") return;
    if (!slot.toolJsonBuffer) return;
    const raw = slot.toolJsonBuffer.trim();
    if (!raw) return;
    try {
      // 尝试直接解析完整 JSON；若为裸字串片段，做一次修复
      slot.ref.input = JSON.parse(raw);
    } catch {
      // 容错：尝试补齐 JSON（例如少量逗号/丢尾），否则作为字符串原样输出
      // 这里不做激进修复，只保底为字符串，避免抛错中断
      slot.ref.input = raw;
    }
    // 清空缓冲
    slot.toolJsonBuffer = "";
  };

  for (let i = 0; i < rawChunks.length; i++) {
    const raw = rawChunks[i];
    let evt;
    try {
      evt = parseMaybeJson(raw);
      if (!evt) {
        debug.ignoredCount++;
        continue;
      }
      debug.parsedCount++;
    } catch (e) {
      debug.errors.push({ idx: i, error: e.message, raw });
      continue;
    }

    const t = evt.type;

    switch (t) {
      case "ping":
        // 心跳，无内容
        break;

      case "message_start": {
        // evt.message 里常携带 id/model/usage
        const m = evt.message || {};
        if (m.id) message.id = m.id;
        if (m.model) message.model = m.model;
        if (m.usage?.input_tokens) message.usage.input_tokens += Number(m.usage.input_tokens) || 0;
        if (m.usage?.output_tokens) message.usage.output_tokens += Number(m.usage.output_tokens) || 0;
        break;
      }

      case "content_block_start": {
        const idx = evt.index ?? 0;
        const block = evt.content_block;
        // 文本块或工具块都在这里创建
        ensureBlock(idx, { content_block: block });
        break;
      }

      case "content_block_delta": {
        const idx = evt.index ?? 0;
        const slot = ensureBlock(idx);
        const d = evt.delta || evt; // 兼容有的实现把字段拍平

        // 文本增量
        if (d.type === "text_delta" && typeof d.text === "string") {
          if (slot.ref.type !== "text") {
            // 如果之前误判为工具，则转为文本（极少见）
            slot.ref = { type: "text", text: "" };
            message.content.push(slot.ref);
          }
          slot.ref.text += d.text;
          break;
        }

        // 工具输入增量：partial_json / input_json / input_json_delta（都当作字符串片段拼接）
        if (slot.ref.type === "tool_use") {
          if (typeof d.partial_json === "string") {
            feedToolJson(slot, d.partial_json);
          } else if (typeof d.input_json === "string") {
            feedToolJson(slot, d.input_json);
          } else if (typeof d.input_json_delta === "string") {
            feedToolJson(slot, d.input_json_delta);
          } else if (d.json !== undefined) {
            // 有些实现可能用 json 字段携带片段
            feedToolJson(slot, d.json);
          }
        }
        break;
      }

      case "content_block_stop": {
        const idx = evt.index ?? 0;
        const slot = blockMap.get(idx);
        // 若是工具块，尝试把缓冲片段解析为最终 input
        finalizeToolInputIfAny(slot);
        break;
      }

      case "message_delta": {
        // 累计 usage 增量、停止原因等
        if (evt.delta?.stop_reason !== undefined) {
          message.stop_reason = evt.delta.stop_reason;
        }
        if (evt.delta?.stop_sequence !== undefined) {
          message.stop_sequence = evt.delta.stop_sequence;
        }
        if (evt.usage) {
          if (evt.usage.output_tokens) {
            message.usage.output_tokens += Number(evt.usage.output_tokens) || 0;
          }
          if (evt.usage.input_tokens) {
            message.usage.input_tokens += Number(evt.usage.input_tokens) || 0;
          }
        }
        break;
      }

      case "message_stop": {
        // 终止事件，通常无需额外处理
        break;
      }

      default: {
        // 未识别事件，忽略
        debug.ignoredCount++;
      }
    }
  }

  // 收尾：确保所有工具块的 JSON 缓冲被解析
  for (const slot of blockMap.values()) {
    finalizeToolInputIfAny(slot);
  }
  message.content = message.content.filter(
	b => !(b.type === 'text' && b.text.trim() === '')
  );
  
  if(message.content.length == 0){
	  for( c in rawChunks){
		  console.log(c);
	  }
  }


  return  message;
}

/* =========================
 * 使用示例
 * =========================
const chunks = [
  'data: {"type":"message_start","message":{"id":"msg_1","model":"claude-3-5-sonnet","usage":{"input_tokens":42}}}',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你好，"}}',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"这里是 Claude。"}}',
  'data: {"type":"content_block_stop","index":0}',

  'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"search"}}',
  'data: {"type":"content_block_delta","index":1,"delta":{"partial_json":"{\\"q\\":\\"Node.js\\","}}',
  'data: {"type":"content_block_delta","index":1,"delta":{"partial_json":"\\"limit\\":5}"}}',
  'data: {"type":"content_block_stop","index":1}',

  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":18}}',
  'data: {"type":"message_stop"}'
];

const { message, debug } = mergeAnthropicChunks(chunks);
console.log(JSON.stringify(message, null, 2), debug);
*/


export default mergeAnthropicChunks;

// ---------------- 示例 ----------------
// const chunks = [...]; // 这里放从 SSE 收集的 chunk
// const merged = mergeAnthropicChunks(chunks);
// console.log(JSON.stringify(merged, null, 2));
