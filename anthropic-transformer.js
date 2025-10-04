// Converted from TypeScript to JavaScript (ESM)
import { v4 as uuidv4 } from "uuid";

function getThinkLevel(thinking_budget) {
  if (thinking_budget <= 0) return "none";
  if (thinking_budget <= 1024) return "low";
  if (thinking_budget <= 8192) return "medium";
  return "high";
}

function createApiError(
  message,
  statusCode = 500,
  code = "internal_error",
  type = "api_error"
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.type = type;
  return error;
}


class AnthropicTransformer {
  name = "Anthropic";
  endPoint = "/v1/messages";
  useBearer;

  constructor(options) {
    this.options = options;
    this.useBearer = this.options?.UseBearer ?? false;
  }

  async auth(request, provider) {
    const headers = {};

    if (this.useBearer) {
      headers["authorization"] = `Bearer ${provider.apiKey}`;
      headers["x-api-key"] = undefined;
    } else {
      headers["x-api-key"] = provider.apiKey;
      headers["authorization"] = undefined;
    }

    return {
      body: request,
      config: {
        headers,
      },
    };
  }

  async transformRequestOut(request) {
    const messages = [];

    if (request.system) {
      if (typeof request.system === "string") {
        messages.push({
          role: "system",
          content: request.system,
        });
      } else if (Array.isArray(request.system) && request.system.length) {
        const textParts = request.system
          .filter((item) => item.type === "text" && item.text)
          .map((item) => ({
            type: "text",
            text: item.text,
            cache_control: item.cache_control,
          }));
        messages.push({
          role: "system",
          content: textParts,
        });
      }
    }

    const requestMessages = JSON.parse(JSON.stringify(request.messages || []));

    requestMessages?.forEach((msg) => {
      if (msg.role === "user" || msg.role === "assistant") {
        if (typeof msg.content === "string") {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
          return;
        }

        if (Array.isArray(msg.content)) {
          if (msg.role === "user") {
            const toolParts = msg.content.filter(
              (c) => c.type === "tool_result" && c.tool_use_id
            );
            if (toolParts.length) {
              toolParts.forEach((tool) => {
                const toolMessage = {
                  role: "tool",
                  content:
                    typeof tool.content === "string"
                      ? tool.content
                      : JSON.stringify(tool.content),
                  tool_call_id: tool.tool_use_id,
                  cache_control: tool.cache_control,
                };
                messages.push(toolMessage);
              });
            }

            const textAndMediaParts = msg.content.filter(
              (c) =>
                (c.type === "text" && c.text) ||
                (c.type === "image" && c.source)
            );
            if (textAndMediaParts.length) {
              messages.push({
                role: "user",
                content: textAndMediaParts.map((part) => {
                  if (part?.type === "image") {
                    return {
                      type: "image_url",
                      image_url: {
                        url:
                          part.source?.type === "base64"
                            ? `data:${part.source.media_type},${part.source.data}`
                            : part.source.url,
                      },
                      media_type: part.source.media_type,
                    };
                  }
                  return part;
                }),
              });
            }
          } else if (msg.role === "assistant") {
            const assistantMessage = {
              role: "assistant",
              content: "",
            };
            const textParts = msg.content.filter(
              (c) => c.type === "text" && c.text
            );
            if (textParts.length) {
              assistantMessage.content = textParts
                .map((text) => text.text)
                .join("\n");
            }

            const toolCallParts = msg.content.filter(
              (c) => c.type === "tool_use" && c.id
            );
            if (toolCallParts.length) {
              assistantMessage.tool_calls = toolCallParts.map((tool) => {
                return {
                  id: tool.id,
                  type: "function",
                  function: {
                    name: tool.name,
                    arguments: JSON.stringify(tool.input || {}),
                  },
                };
              });
            }
            messages.push(assistantMessage);
          }
          return;
        }
      }
    });

    const result = {
      messages,
      model: request.model,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: request.stream,
      tools: request.tools?.length
        ? this.convertAnthropicToolsToUnified(request.tools)
        : undefined,
      tool_choice: request.tool_choice,
    };
    if (request.thinking) {
      result.reasoning = {
        effort: getThinkLevel(request.thinking.budget_tokens),
        // max_tokens: request.thinking.budget_tokens,
        enabled: request.thinking.type === "enabled",
      };
    }
    if (request.tool_choice) {
      if (request.tool_choice.type === "tool") {
        result.tool_choice = {
          type: "function",
          function: { name: request.tool_choice.name },
        };
      } else {
        result.tool_choice = request.tool_choice.type;
      }
    }
    return result;
  }

  async transformResponseIn(response) {
    const isStream = response.headers.get("Content-Type")?.includes("text/event-stream");
    //处理流式返回
    if (isStream) {
      if (!response.body) {
        throw new Error("Stream response body is null");
      }
      const convertedStream = await this.convertOpenAIStreamToAnthropic(
        response.body
      );
      //console.log("转换后的流:", convertedStream);
      return new Response(convertedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      const data = await response.json();
      //console.log("转换后的非流式响应:", data);
      const anthropicResponse = this.convertOpenAIResponseToAnthropic(data);
      return new Response(JSON.stringify(anthropicResponse), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  convertAnthropicToolsToUnified(tools) {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.input_schema,
      },
    }));
  }

  async convertOpenAIStreamToAnthropic(openaiStream) {
    const readable = new ReadableStream({
      start: async (controller) => {
        const encoder = new TextEncoder();
        const messageId = `msg_${Date.now()}`;
        let stopReasonMessageDelta = null;
        let model = "unknown";
        let hasStarted = false;
        let hasTextContentStarted = false;
        let hasFinished = false;
        const toolCalls = new Map();
        const toolCallIndexToContentBlockIndex = new Map();
        let totalChunks = 0;
        let contentChunks = 0;
        let toolCallChunks = 0;
        let isClosed = false;
        let isThinkingStarted = false;
        let contentIndex = 0;
        let currentContentBlockIndex = -1;

        const safeEnqueue = (data) => {
          if (!isClosed) {
            try {
              controller.enqueue(data);
              const dataStr = new TextDecoder().decode(data);
              this.logger && this.logger.debug({ dataStr }, `send data`);
            } catch (error) {
              if (
                error instanceof TypeError &&
                error.message.includes("Controller is already closed")
              ) {
                isClosed = true;
              } else {
                this.logger && this.logger.debug(`send data error: ${error.message}`);
                throw error;
              }
            }
          }
        };

        const safeClose = () => {
          if (!isClosed) {
            try {
              if (currentContentBlockIndex >= 0) {
                const contentBlockStop = {
                  type: "content_block_stop",
                  index: currentContentBlockIndex,
                };
                safeEnqueue(
                  encoder.encode(
                    `event: content_block_stop\ndata: ${JSON.stringify(
                      contentBlockStop
                    )}\n\n`
                  )
                );
                currentContentBlockIndex = -1;
              }

              if (stopReasonMessageDelta) {
                safeEnqueue(
                  encoder.encode(
                    `event: message_delta\ndata: ${JSON.stringify(
                      stopReasonMessageDelta
                    )}\n\n`
                  )
                );
                stopReasonMessageDelta = null;
              } else {
                safeEnqueue(
                  encoder.encode(
                    `event: message_delta\ndata: ${JSON.stringify({
                      type: "message_delta",
                      delta: {
                        stop_reason: "end_turn",
                        stop_sequence: null,
                      },
                      usage: {
                        input_tokens: 0,
                        output_tokens: 0,
                        cache_read_input_tokens: 0,
                      },
                    })}\n\n`
                  )
                );
              }
              const messageStop = {
                type: "message_stop",
              };
              safeEnqueue(
                encoder.encode(
                  `event: message_stop\ndata: ${JSON.stringify(
                    messageStop
                  )}\n\n`
                )
              );
              controller.close();
              isClosed = true;
            } catch (error) {
              if (
                error instanceof TypeError &&
                error.message.includes("Controller is already closed")
              ) {
                isClosed = true;
              } else {
                throw error;
              }
            }
          }
        };

        let reader = null;

        try {
          reader = openaiStream.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            if (isClosed) {
              break;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (isClosed || hasFinished) break;

              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              this.logger && this.logger.debug(`recieved data: ${data}`);

              if (data === "[DONE]") {
                continue;
              }

              try {
                const chunk = JSON.parse(data);
                totalChunks++;
                this.logger && this.logger.debug({ response: chunk }, `Original Response`);
                if (chunk.error) {
                  const errorMessage = {
                    type: "error",
                    message: {
                      type: "api_error",
                      message: JSON.stringify(chunk.error),
                    },
                  };

                  safeEnqueue(
                    encoder.encode(
                      `event: error\ndata: ${JSON.stringify(errorMessage)}\n\n`
                    )
                  );
                  continue;
                }

                model = chunk.model || model;

                if (!hasStarted && !isClosed && !hasFinished) {
                  hasStarted = true;

                  const messageStart = {
                    type: "message_start",
                    message: {
                      id: messageId,
                      type: "message",
                      role: "assistant",
                      content: [],
                      model: model,
                      stop_reason: null,
                      stop_sequence: null,
                      usage: {
                        input_tokens: 0,
                        output_tokens: 0,
                      },
                    },
                  };

                  safeEnqueue(
                    encoder.encode(
                      `event: message_start\ndata: ${JSON.stringify(
                        messageStart
                      )}\n\n`
                    )
                  );
                }

                const choice = chunk.choices?.[0];
                if (chunk.usage) {
                  if (!stopReasonMessageDelta) {
                    stopReasonMessageDelta = {
                      type: "message_delta",
                      delta: {
                        stop_reason: "end_turn",
                        stop_sequence: null,
                      },
                      usage: {
                        input_tokens: chunk.usage?.prompt_tokens || 0,
                        output_tokens: chunk.usage?.completion_tokens || 0,
                        cache_read_input_tokens:
                          chunk.usage?.cache_read_input_tokens || 0,
                      },
                    };
                  } else {
                    stopReasonMessageDelta.usage = {
                      input_tokens: chunk.usage?.prompt_tokens || 0,
                      output_tokens: chunk.usage?.completion_tokens || 0,
                      cache_read_input_tokens:
                        chunk.usage?.cache_read_input_tokens || 0,
                    };
                  }
                }
                if (!choice) {
                  continue;
                }

                if (choice?.delta?.thinking && !isClosed && !hasFinished) {
                  if (currentContentBlockIndex >= 0) {
                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: currentContentBlockIndex,
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    );
                    currentContentBlockIndex = -1;
                  }

                  if (!isThinkingStarted) {
                    const contentBlockStart = {
                      type: "content_block_start",
                      index: contentIndex,
                      content_block: { type: "thinking", thinking: "" },
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_start\ndata: ${JSON.stringify(
                          contentBlockStart
                        )}\n\n`
                      )
                    );
                    currentContentBlockIndex = contentIndex;
                    isThinkingStarted = true;
                  }
                  if (choice.delta.thinking.signature) {
                    const thinkingSignature = {
                      type: "content_block_delta",
                      index: contentIndex,
                      delta: {
                        type: "signature_delta",
                        signature: choice.delta.thinking.signature,
                      },
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_delta\ndata: ${JSON.stringify(
                          thinkingSignature
                        )}\n\n`
                      )
                    );
                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: contentIndex,
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    );
                    currentContentBlockIndex = -1;
                    contentIndex++;
                  } else if (choice.delta.thinking.content) {
                    const thinkingChunk = {
                      type: "content_block_delta",
                      index: contentIndex,
                      delta: {
                        type: "thinking_delta",
                        thinking: choice.delta.thinking.content || "",
                      },
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_delta\ndata: ${JSON.stringify(
                          thinkingChunk
                        )}\n\n`
                      )
                    );
                  }
                }

                if (choice?.delta?.content && !isClosed && !hasFinished) {
                  contentChunks++;

                  if (currentContentBlockIndex >= 0) {
                    const isCurrentTextBlock = hasTextContentStarted;
                    if (!isCurrentTextBlock) {
                      const contentBlockStop = {
                        type: "content_block_stop",
                        index: currentContentBlockIndex,
                      };
                      safeEnqueue(
                        encoder.encode(
                          `event: content_block_stop\ndata: ${JSON.stringify(
                            contentBlockStop
                          )}\n\n`
                        )
                      );
                      currentContentBlockIndex = -1;
                    }
                  }

                  if (!hasTextContentStarted && !hasFinished) {
                    hasTextContentStarted = true;
                    const contentBlockStart = {
                      type: "content_block_start",
                      index: contentIndex,
                      content_block: {
                        type: "text",
                        text: "",
                      },
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_start\ndata: ${JSON.stringify(
                          contentBlockStart
                        )}\n\n`
                      )
                    );
                    currentContentBlockIndex = contentIndex;
                  }

                  if (!isClosed && !hasFinished) {
                    const anthropicChunk = {
                      type: "content_block_delta",
                      index: currentContentBlockIndex,
                      delta: {
                        type: "text_delta",
                        text: choice.delta.content,
                      },
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_delta\ndata: ${JSON.stringify(
                          anthropicChunk
                        )}\n\n`
                      )
                    );
                  }
                }

                if (
                  choice?.delta?.annotations?.length &&
                  !isClosed &&
                  !hasFinished
                ) {
                  if (currentContentBlockIndex >= 0 && hasTextContentStarted) {
                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: currentContentBlockIndex,
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    );
                    currentContentBlockIndex = -1;
                    hasTextContentStarted = false;
                  }

                  choice?.delta?.annotations.forEach((annotation) => {
                    contentIndex++;
                    const contentBlockStart = {
                      type: "content_block_start",
                      index: contentIndex,
                      content_block: {
                        type: "web_search_tool_result",
                        tool_use_id: `srvtoolu_${uuidv4()}`,
                        content: [
                          {
                            type: "web_search_result",
                            title: annotation.url_citation.title,
                            url: annotation.url_citation.url,
                          },
                        ],
                      },
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_start\ndata: ${JSON.stringify(
                          contentBlockStart
                        )}\n\n`
                      )
                    );

                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: contentIndex,
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    );
                    currentContentBlockIndex = -1;
                  });
                }

                if (choice?.delta?.tool_calls && !isClosed && !hasFinished) {
                  toolCallChunks++;
                  const processedInThisChunk = new Set();

                  for (const toolCall of choice.delta.tool_calls) {
                    if (isClosed) break;
                    const toolCallIndex = toolCall.index ?? 0;
                    if (processedInThisChunk.has(toolCallIndex)) {
                      continue;
                    }
                    processedInThisChunk.add(toolCallIndex);
                    const isUnknownIndex =
                      !toolCallIndexToContentBlockIndex.has(toolCallIndex);

                    if (isUnknownIndex) {
                      if (currentContentBlockIndex >= 0) {
                        const contentBlockStop = {
                          type: "content_block_stop",
                          index: currentContentBlockIndex,
                        };
                        safeEnqueue(
                          encoder.encode(
                            `event: content_block_stop\ndata: ${JSON.stringify(
                              contentBlockStop
                            )}\n\n`
                          )
                        );
                        currentContentBlockIndex = -1;
                      }

                      const newContentBlockIndex = contentIndex;
                      toolCallIndexToContentBlockIndex.set(
                        toolCallIndex,
                        newContentBlockIndex
                      );
                      contentIndex++;
                      const toolCallId =
                        toolCall.id || `call_${Date.now()}_${toolCallIndex}`;
                      const toolCallName =
                        toolCall.function?.name || `tool_${toolCallIndex}`;
                      const contentBlockStart = {
                        type: "content_block_start",
                        index: newContentBlockIndex,
                        content_block: {
                          type: "tool_use",
                          id: toolCallId,
                          name: toolCallName,
                          input: {},
                        },
                      };

                      safeEnqueue(
                        encoder.encode(
                          `event: content_block_start\ndata: ${JSON.stringify(
                            contentBlockStart
                          )}\n\n`
                        )
                      );
                      currentContentBlockIndex = newContentBlockIndex;

                      const toolCallInfo = {
                        id: toolCallId,
                        name: toolCallName,
                        arguments: "",
                        contentBlockIndex: newContentBlockIndex,
                      };
                      toolCalls.set(toolCallIndex, toolCallInfo);
                    } else if (toolCall.id && toolCall.function?.name) {
                      const existingToolCall = toolCalls.get(toolCallIndex);
                      const wasTemporary =
                        existingToolCall.id.startsWith("call_") &&
                        existingToolCall.name.startsWith("tool_");

                      if (wasTemporary) {
                        existingToolCall.id = toolCall.id;
                        existingToolCall.name = toolCall.function.name;
                      }
                    }

                    if (
                      toolCall.function?.arguments &&
                      !isClosed &&
                      !hasFinished
                    ) {
                      const blockIndex =
                        toolCallIndexToContentBlockIndex.get(toolCallIndex);
                      if (blockIndex === undefined) {
                        continue;
                      }
                      const currentToolCall = toolCalls.get(toolCallIndex);
                      if (currentToolCall) {
                        currentToolCall.arguments +=
                          toolCall.function.arguments;
                      }

                      try {
                        const anthropicChunk = {
                          type: "content_block_delta",
                          index: blockIndex,
                          delta: {
                            type: "input_json_delta",
                            partial_json: toolCall.function.arguments,
                          },
                        };
                        safeEnqueue(
                          encoder.encode(
                            `event: content_block_delta\ndata: ${JSON.stringify(
                              anthropicChunk
                            )}\n\n`
                          )
                        );
                      } catch (error) {
                        try {
                          const fixedArgument = toolCall.function.arguments
                            .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
                            .replace(/\\/g, "\\\\")
                            .replace(/"/g, '\\"');

                          const fixedChunk = {
                            type: "content_block_delta",
                            index: blockIndex,
                            delta: {
                              type: "input_json_delta",
                              partial_json: fixedArgument,
                            },
                          };
                          safeEnqueue(
                            encoder.encode(
                              `event: content_block_delta\ndata: ${JSON.stringify(
                                fixedChunk
                              )}\n\n`
                            )
                          );
                        } catch (fixError) {
                          console.error(fixError);
                        }
                      }
                    }
                  }
                }

                if (choice?.finish_reason && !isClosed && !hasFinished) {
                  if (contentChunks === 0 && toolCallChunks === 0) {
                    console.error(
                      "Warning: No content in the stream response!"
                    );
                  }

                  if (currentContentBlockIndex >= 0) {
                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: currentContentBlockIndex,
                    };
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    );
                    currentContentBlockIndex = -1;
                  }

                  if (!isClosed) {
                    const stopReasonMapping = {
                      stop: "end_turn",
                      length: "max_tokens",
                      tool_calls: "tool_use",
                      content_filter: "stop_sequence",
                    };

                    const anthropicStopReason =
                      stopReasonMapping[choice.finish_reason] || "end_turn";

                    stopReasonMessageDelta = {
                      type: "message_delta",
                      delta: {
                        stop_reason: anthropicStopReason,
                        stop_sequence: null,
                      },
                      usage: {
                        input_tokens: chunk.usage?.prompt_tokens || 0,
                        output_tokens: chunk.usage?.completion_tokens || 0,
                        cache_read_input_tokens:
                          chunk.usage?.cache_read_input_tokens || 0,
                      },
                    };
                  }

                  break;
                }
              } catch (parseError) {
                this.logger?.error &&
                  this.logger?.error(
                    `parseError: ${parseError.name} message: ${parseError.message} stack: ${parseError.stack} data: ${data}`
                  );
              }
            }
          }
          safeClose();
        } catch (error) {
          if (!isClosed) {
            try {
              controller.error(error);
            } catch (controllerError) {
              console.error(controllerError);
            }
          }
        } finally {
          if (reader) {
            try {
              reader.releaseLock();
            } catch (releaseError) {
              console.error(releaseError);
            }
          }
        }
      },
      cancel: (reason) => {
        this.logger && this.logger.debug(`cancle stream: ${reason}`);
      },
    });

    return readable;
  }

  convertOpenAIResponseToAnthropic(openaiResponse) {
    this.logger && this.logger.debug({ response: openaiResponse }, `Original OpenAI response`);
    try {
      const choice = openaiResponse.choices[0];
      if (!choice) {
        throw new Error("No choices found in OpenAI response");
      }
      const content = [];
      if (choice.message.annotations) {
        const id = `srvtoolu_${uuidv4()}`;
        content.push({
          type: "server_tool_use",
          id,
          name: "web_search",
          input: {
            query: "",
          },
        });
        content.push({
          type: "web_search_tool_result",
          tool_use_id: id,
          content: choice.message.annotations.map((item) => {
            return {
              type: "web_search_result",
              url: item.url_citation.url,
              title: item.url_citation.title,
            };
          }),
        });
      }
      if (choice.message.content) {
        content.push({
          type: "text",
          text: choice.message.content,
        });
      }
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        choice.message.tool_calls.forEach((toolCall) => {
          let parsedInput = {};
          try {
            const argumentsStr = toolCall.function.arguments || "{}";

            if (typeof argumentsStr === "object") {
              parsedInput = argumentsStr;
            } else if (typeof argumentsStr === "string") {
              parsedInput = JSON.parse(argumentsStr);
            }
          } catch (parseError) {
            parsedInput = { text: toolCall.function.arguments || "" };
          }

          content.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: parsedInput,
          });
        });
      }

      const result = {
        id: openaiResponse.id,
        type: "message",
        role: "assistant",
        model: openaiResponse.model,
        content: content,
        stop_reason:
          choice.finish_reason === "stop"
            ? "end_turn"
            : choice.finish_reason === "length"
            ? "max_tokens"
            : choice.finish_reason === "tool_calls"
            ? "tool_use"
            : choice.finish_reason === "content_filter"
            ? "stop_sequence"
            : "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: openaiResponse.usage?.prompt_tokens || 0,
          output_tokens: openaiResponse.usage?.completion_tokens || 0,
        },
      };
      this.logger && this.logger.debug(
        { result },
        `Conversion complete, final Anthropic response`
      );
      return result;
    } catch (e) {
      throw createApiError(
        `Provider error: ${JSON.stringify(openaiResponse)}`,
        500,
        "provider_error"
      );
    }
  }
}

export default new AnthropicTransformer();
