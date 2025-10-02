# Codex CLI Proxy + Logger

- 接受 Codex/Anthropic 风格的 `/v1/messages` 请求，转发到 OpenRouter（或自定义上游），并将请求/响应归档到用户目录下 `~/.clilogger/logs/`。
- 支持 SSE 流式与非流式响应，自动合并流式分块，输出简化与完整两类日志。

## 快速开始

- 安装依赖：`npm i`
- 启动代理：`node uclaude.js`
- 导出 Codex CLI 所需环境变量：
  - PowerShell: `node uclaude.js env | Invoke-Expression`
  - Bash/zsh: `eval "$(node uclaude.js env | sed 's/^\$env:/export /; s/ = /=/; s/'\''//g')"`

Codex/Cli 或任一 Anthropic SDK 指向：

- `ANTHROPIC_BASE_URL=http://127.0.0.1:3000`
- `ANTHROPIC_AUTH_TOKEN=<任意非空值>`（代理侧默认不校验该值）
- `ANTHROPIC_MODEL=anthropic/claude-sonnet-4`（或你要映射的上游模型）

## 路由与上游

- 本地代理暴露：`POST /v1/messages`
- 上游（默认）：`https://openrouter.ai/api/v1/chat/completions`
  - 可通过 `ANTHROPIC_PROXY_BASE_URL` 覆盖上游，设置后将不再自动附加 `Authorization: Bearer <OPENROUTER_API_KEY>` 头。
  - 未设置 `ANTHROPIC_PROXY_BASE_URL` 时，上游默认为 OpenRouter，需提供 `OPENROUTER_API_KEY`。

## 日志

- 完整日志：`~/.clilogger/logs/api-full-*.log`
- 简化日志（仅 messages 与 content）：`~/.clilogger/logs/api-simple-*.log`

## 备注

- 代码示例 `test.js` 展示了如何对接 DeepSeek 兼容的 Anthropic Endpoint。
- 若需要代理 Codex Web 的 `/backend-api/codex/responses`，可参考 `codex.js` 中的样例透传实现。
