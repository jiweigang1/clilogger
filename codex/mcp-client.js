/**
 * OAuth-transparent MCP Client (Node.js, JavaScript)
 *
 * Goals:
 * - Same high-level interface as `@modelcontextprotocol/sdk/client`'s Client:
 *   - connect(transport)
 *   - listPrompts()
 *   - getPrompt({ name, arguments })
 *   - listResources()
 *   - readResource({ uri })
 *   - listTools()
 *   - callTool({ name, arguments })
 * - No dependency on `@modelcontextprotocol/sdk/client`.
 * - Adds automatic OAuth 2.0 (Authorization Code + PKCE) sign-in.
 *   The client detects missing/expired auth and performs the flow transparently.
 * - Supports OAuth metadata discovery (RFC 8414) and Dynamic Client Registration (RFC 7591).
 *
 * Transport supported here:
 * - Streamable HTTP (JSON-RPC 2.0 over HTTP). Stdio can be added by implementing
 *   a Transport with a `send(method, params)` function and passing into Client.connect().
 *
 * Usage Example (Cloudflare Radar, auto discovery + auto registration):
 *   import { Client, StreamableHTTPClientTransport } from './mcp-client.js'
 *
 *   const issuer = 'https://radar.mcp.cloudflare.com'
 *   const transport = new StreamableHTTPClientTransport(`${issuer}/mcp`, {
 *     oauth: {
 *       issuer, // auto-discovery of /.well-known/oauth-authorization-server
 *       // discoveryUrl: `${issuer}/.well-known/oauth-authorization-server`, // optional explicit
 *       // Do not provide clientId => dynamic client registration to /register
 *       scopes: ['openid','profile','email','offline_access'],
 *       redirectUri: 'http://127.0.0.1:53175/callback',
 *       tokenStorePath: '.mcp_oauth_tokens.json',
 *       clientName: 'demo-auto-reg',
 *       debug: true,                  // enable helpful logs
 *       authTimeoutMs: 180000         // 3 minutes timeout to avoid hanging
 *     }
 *   })
 *
 *   const client = new Client({ name: 'radar-demo', version: '1.0.0' })
 *   await client.connect(transport)
 *   console.log(await client.listTools())
 *   // const result = await client.callTool({ name: 'some_tool', arguments: {} })
 *   // console.log(result)
 */

import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { URL, URLSearchParams } from 'node:url'

/** Utility: open system browser cross-platform */
function openInBrowser(url) {
  const href = typeof url === 'string' ? url : url.href
  const platform = process.platform
  console.log('[oauth] opening browser at:' + platform , href);
  try {
    if (platform === 'darwin') {
      spawn('open', [href], { stdio: 'ignore', detached: true }).unref()
    } else if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""',  href.replace(/&/g, '^&')], { stdio: 'ignore', detached: true }).unref()
    } else {
      const candidates = ['xdg-open', 'x-www-browser', 'gnome-open', 'kde-open']
      spawn(candidates[0], [href], { stdio: 'ignore', detached: true }).unref()
    }
  } catch (e) {
    console.warn('[oauth] failed to open browser automatically. Please open this URL manually:', href)
  }
}

/** Simple JSON file token store */
class TokenStore {
  constructor(filePath = '.mcp_oauth_tokens.json') {
    this.filePath = filePath
    this.cache = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf-8')) : {}
  }
  get(key) { return this.cache[key] }
  set(key, value) { this.cache[key] = value; writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2)) }
  delete(key) { delete this.cache[key]; writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2)) }
}

/** OAuth2 PKCE helper with Discovery + Dynamic Client Registration */
class OAuthManager {
  constructor({ issuer, discoveryUrl, authorizationUrl, tokenUrl, registrationUrl, clientId, scopes = [], redirectUri, tokenStorePath, clientName = 'mcp-client-js', debug = true, authTimeoutMs = 180000 }) {
    // Config (some may be discovered later)
    this.issuer = issuer ? new URL(issuer).origin : undefined
    this.discoveryUrl = discoveryUrl ? new URL(discoveryUrl) : undefined
    this.authorizationUrl = authorizationUrl ? new URL(authorizationUrl) : undefined
    this.tokenUrl = tokenUrl ? new URL(tokenUrl) : undefined
    this.registrationUrl = registrationUrl ? new URL(registrationUrl) : undefined
    this.clientId = clientId
    this.clientName = clientName
    this.scopes = scopes
    this.redirectUri = new URL(redirectUri)
    this.store = new TokenStore(tokenStorePath)
    this.debug = !!debug
    this.authTimeoutMs = authTimeoutMs || 180000

    // distinct keys so rotating server metadata doesn't clobber tokens
    this.metaKey = `meta|${this.issuer || this.authorizationUrl?.origin || this.tokenUrl?.origin}`
    this.storeKey = `tokens|${this.tokenUrl?.origin || this.issuer}|${this.clientId || 'auto'}`
  }

  /** Ensure we have server metadata (RFC 8414) and endpoints. */
  async discoverIfNeeded() {
    let meta = this.store.get(this.metaKey)
    if (!this.authorizationUrl || !this.tokenUrl || !this.registrationUrl) {
      // Try in-memory meta first
      if (!meta) {
        let base
        if (this.discoveryUrl) {
          base = this.discoveryUrl
        } else if (this.issuer) {
          base = new URL(`${this.issuer}/.well-known/oauth-authorization-server`)
        } else if (this.authorizationUrl) {
          base = new URL(`${this.authorizationUrl.origin}/.well-known/oauth-authorization-server`)
        } else if (this.tokenUrl) {
          base = new URL(`${this.tokenUrl.origin}/.well-known/oauth-authorization-server`)
        } else {
          throw new Error('OAuth discovery requires issuer, discoveryUrl, authorizationUrl, or tokenUrl')
        }
        const resp = await fetch(base)
        if (!resp.ok) throw new Error(`OAuth discovery failed: ${resp.status}`)
        meta = await resp.json()
        this.store.set(this.metaKey, meta)
        if (this.debug) console.log('[oauth] discovery metadata:', meta)
      }
      if (!this.authorizationUrl && meta.authorization_endpoint) this.authorizationUrl = new URL(meta.authorization_endpoint)
      if (!this.tokenUrl && meta.token_endpoint) this.tokenUrl = new URL(meta.token_endpoint)
      if (!this.registrationUrl && meta.registration_endpoint) this.registrationUrl = new URL(meta.registration_endpoint)

      if (this.debug) {
        console.log('[oauth] discovered endpoints:', {
          authorization_endpoint: this.authorizationUrl?.href,
          token_endpoint: this.tokenUrl?.href,
          registration_endpoint: this.registrationUrl?.href || '(none)'
        })
      }
    }
  }

  /** Ensure we have a client_id, using Dynamic Client Registration (RFC 7591) if needed. */
  async ensureClientId() {
    if (this.clientId) return this.clientId
    await this.discoverIfNeeded()
    if (!this.registrationUrl) {
      if (this.debug) console.warn('[oauth] no registration_endpoint; dynamic registration disabled. You must set oauth.clientId explicitly.')
      throw new Error('Server does not advertise dynamic client registration; please supply oauth.clientId')
    }

    const body = {
      client_name: this.clientName,
      application_type: 'native', // desktop/cli style public client
      redirect_uris: [this.redirectUri.href],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // PKCE public client
      scope: this.scopes.join(' '),
    }
    const resp = await fetch(this.registrationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) throw new Error(`Client registration failed: ${resp.status}`)
    const json = await resp.json()
    this.clientId = json.client_id
    const regKey = `reg|${this.authorizationUrl.origin}|${this.redirectUri.href}`
    this.store.set(regKey, { client_id: this.clientId, obtained_at: Date.now() })
    this.storeKey = `tokens|${this.tokenUrl.origin}|${this.clientId}`
    if (this.debug) console.log('[oauth] dynamic client registered:', this.clientId)
    return this.clientId
  }

  /** Return a valid access token (refresh if needed, or run full flow). */
  async getAccessToken() {
    await this.discoverIfNeeded()
    await this.ensureClientId().catch((e) => { throw e })
    const record = this.store.get(this.storeKey)
    if (record) {
      const { access_token, expires_at, refresh_token } = record
      if (expires_at && Date.now() < expires_at - 30_000) {
        if (this.debug) console.log('[oauth] reuse cached token (valid)')
        return access_token
      }
      if (refresh_token) {
        try {
          if (this.debug) console.log('[oauth] refreshing access token...')
          return await this.refresh(refresh_token)
        } catch (err) {
          if (this.debug) console.warn('[oauth] refresh failed, falling back to full auth:', err?.message)
        }
      }
    }
    return await this.runAuthCodeFlow()
  }

  async refresh(refresh_token) {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: this.clientId,
    })
    const resp = await fetch(this.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    if (!resp.ok) throw new Error(`OAuth refresh failed: ${resp.status}`)
    const json = await resp.json()
    this.persistTokens(json)
    if (this.debug) console.log('[oauth] refresh ok; expires_in:', json.expires_in)
    return json.access_token
  }

  /** Full PKCE flow with loopback listener on redirectUri. */
  async runAuthCodeFlow() {
    const { verifier, challenge } = this.generatePkce()
    const state = randomBytes(16).toString('hex')

    // Start a tiny loopback server to capture the code
    const { server, codePromise } = this.listenForCode(state)

    const authUrl = new URL(this.authorizationUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', this.clientId)
    authUrl.searchParams.set('redirect_uri', this.redirectUri.href)
    authUrl.searchParams.set('scope', this.scopes.join(' '))
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', state)

    if (this.debug) console.log('[oauth] opening authorize URL:', authUrl.href)
    //这里只需要打开授权地址，随后本地回调服务器会接收授权码并继续 PKCE 流程获取访问令牌
    openInBrowser(authUrl)

    // timeout guard to avoid hanging forever
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('OAuth authorize timed out')), this.authTimeoutMs))
    const { code, recvState } = await Promise.race([codePromise, timeout])

    server.close()
    if (recvState !== state) throw new Error('OAuth state mismatch')

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri.href,
      client_id: this.clientId,
      code_verifier: verifier,
    })

    const resp = await fetch(this.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    if (!resp.ok) {
         console.error('[oauth] token exchange failed url:', this.tokenUrl + "");
         console.error('[oauth] token exchange failed body:', body + "");
         console.error('[oauth] token exchange failed response:', await resp.text());
       throw new Error(`OAuth token exchange failed: ${resp.status}`);
    }
    const json = await resp.json()
    this.persistTokens(json)
    if (this.debug) console.log('[oauth] auth ok; expires_in:', json.expires_in)
    return json.access_token
  }

  generatePkce() {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    return { verifier, challenge }
  }

  listenForCode(expectedState) {
    const url = new URL(this.redirectUri)
    const port = Number(url.port || 80)
    const pathname = url.pathname

    let resolve, reject
    const codePromise = new Promise((res, rej) => { resolve = res; reject = rej })

    const server = createServer((req, res) => {
      try {
        if (req.method !== 'GET') { res.statusCode = 405; res.end('Method Not Allowed'); return }
        const reqUrl = new URL(req.url, `${url.protocol}//${url.host}`)
        if (reqUrl.pathname !== pathname) { res.statusCode = 404; res.end('Not Found'); return }
        const code = reqUrl.searchParams.get('code')
        const state = reqUrl.searchParams.get('state')

        console.log('[oauth] received code:', code);
        console.log('[oauth] received state:', state);

        if (!code) { res.statusCode = 400; res.end('Missing code'); return }
        res.statusCode = 200
        res.end('<html><body>Authentication complete. You may close this window.</body></html>')
        resolve({ code, recvState: state })
      } catch (err) {
        reject(err)
      }
    })
    server.listen(port, '127.0.0.1')
    return { server, codePromise }
  }

  persistTokens(json) {
    const expires_at = json.expires_in ? Date.now() + (json.expires_in * 1000) : undefined
    const toStore = { ...json, expires_at }
    this.store.set(this.storeKey, toStore)
  }
}

/**
 * Minimal Streamable HTTP client transport (JSON-RPC 2.0 over HTTP with sessions)
 *
 * Server must support MCP Streamable HTTP endpoint. This transport manages:
 * - Session header (Mcp-Session-Id) from the init response
 * - OAuth bearer token acquisition/refresh via OAuthManager when provided
 */
export class StreamableHTTPClientTransport {
  constructor(baseUrl, { oauth } = {}) {
    this.baseUrl = new URL(baseUrl)
    this.oauth = oauth ? new OAuthManager(oauth) : null
    this.sessionId = null
    this.seq = 0
  }

  /** Low-level send of a JSON-RPC request. */
  async send(method, params) {
    const id = ++this.seq
    const body = { jsonrpc: '2.0', id, method, params }

    const headers = { 'Content-Type': 'application/json' }
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId

    // Try attach OAuth if configured
    if (this.oauth) {
      const token = await this.oauth.getAccessToken().catch((e) => {
        console.warn('[oauth] getAccessToken failed:', e?.message)
        return null
      })
      if (token) headers['Authorization'] = `Bearer ${token}`
    }

    console.log('[oauth] sending request:', JSON.stringify({ method, params, headers , body }, null, 2))

    let resp = await fetch(this.baseUrl, { method: 'POST', headers, body: JSON.stringify(body) })

    // If unauthorized and OAuth is configured, try once to re-auth then retry
    if (resp.status === 401 && this.oauth) {
      const token = await this.oauth.runAuthCodeFlow().catch((e) => {
        console.warn('[oauth] re-auth failed:', e?.message)
        return null
      })

      if (!token) {
        const text = await resp.text().catch(() => '')
        throw new Error(`HTTP 401 Unauthorized. Body: ${text}`)
      }
      headers['Authorization'] = `Bearer ${token}`
      resp = await fetch(this.baseUrl, { method: 'POST', headers, body: JSON.stringify(body) })
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status} ${resp.statusText} ${text}`)
    }

    // Capture session id if provided
    const sid = resp.headers.get('Mcp-Session-Id')
    if (sid) this.sessionId = sid

    const json = await resp.json()
    if (json.error) {
      const e = new Error(json.error.message || 'RPC Error')
      e.code = json.error.code
      e.data = json.error.data
      throw e
    }
    return json.result
  }
}

/**
 * High-level MCP Client (SDK-compatible surface)
 */
export class Client {
  constructor({ name, version } = {}) {
    this.name = name || 'mcp-client-js'
    this.version = version || '0.0.0'
    this.connected = false
    this.transport = null
  }

  async connect(transport) {
    this.transport = transport
    // Initialize per MCP spec
    const init = await this.transport.send('initialize', {
      protocolVersion: '2025-05-15', // pick a modern version; adjust if your server differs
      capabilities: {
        prompts: {}, resources: {}, tools: {}, sampling: {},
      },
      clientInfo: { name: this.name, version: this.version }
    })

    // Acknowledge ready
    await this.transport.send('notifications/initialized', {})
    this.connected = true
    this.serverInfo = init?.serverInfo
    this.capabilities = init?.capabilities
    return init
  }

  // === Prompts ===
  async listPrompts() {
    return await this.transport.send('prompts/list', {})
  }
  async getPrompt({ name, arguments: args = {} }) {
    return await this.transport.send('prompts/get', { name, arguments: args })
  }

  // === Resources ===
  async listResources() {
    return await this.transport.send('resources/list', {})
  }
  async readResource({ uri }) {
    return await this.transport.send('resources/read', { uri })
  }

  // === Tools ===
  async listTools() {
    return await this.transport.send('tools/list', {})
  }
  async callTool({ name, arguments: args = {} }) {
    return await this.transport.send('tools/call', { name, arguments: args })
  }

  // === Convenience ===
  get isConnected() { return this.connected }
}

// Optional: default export
export default { Client, StreamableHTTPClientTransport }
