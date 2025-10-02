#!/usr/bin/env node
import { initConfig, loadConfig } from './config.js'
import startProxy from './openrouter.js'
import './clogger.js'

function printHelp() {
  console.log(
    [
      'uclaude - start Codex proxy and logging',
      '',
      'Usage:',
      '  uclaude                 Start proxy on PORT (default 3000)',
      '  uclaude env             Print env exports for Codex CLI',
      '  uclaude help            Show help',
      '',
      'Environment:',
      '  PORT                    Port to listen on (default 3000)',
      '  OPENROUTER_API_KEY      API key when using OpenRouter backend',
      '  ANTHROPIC_PROXY_BASE_URL  Upstream base URL, skips API key header when set',
    ].join('\n')
  )
}

async function main() {
  const cmd = process.argv[2] || 'start'
  initConfig()
  const cfg = loadConfig()

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp()
    return
  }

  if (cmd === 'env') {
    // Default to the local proxy and sonnet-4 mapping
    const base = process.env.ANTHROPIC_BASE_URL || 'http://127.0.0.1:3000'
    const model = process.env.ANTHROPIC_MODEL || 'anthropic/claude-sonnet-4'
    const small = process.env.ANTHROPIC_SMALL_FAST_MODEL || model
    const token = process.env.ANTHROPIC_AUTH_TOKEN || 'dummy'
    // Windows PowerShell compatible output
    console.log(`$env:ANTHROPIC_BASE_URL = '${base}'`)
    console.log(`$env:ANTHROPIC_AUTH_TOKEN = '${token}'`)
    console.log(`$env:ANTHROPIC_MODEL = '${model}'`)
    console.log(`$env:ANTHROPIC_SMALL_FAST_MODEL = '${small}'`)
    console.log('')
    console.log('# For bash/zsh:')
    console.log(`# export ANTHROPIC_BASE_URL='${base}'`)
    console.log(`# export ANTHROPIC_AUTH_TOKEN='${token}'`)
    console.log(`# export ANTHROPIC_MODEL='${model}'`)
    console.log(`# export ANTHROPIC_SMALL_FAST_MODEL='${small}'`)
    return
  }

  // Start the OpenRouter-style proxy (/v1/messages mapping to upstream chat/completions)
  await startProxy()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

