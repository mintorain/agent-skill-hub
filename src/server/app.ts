import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { ZodError, z } from 'zod'
import { isValidSkillName } from '../core/skill-name.js'
import { sourceSchema } from '../config/sources-store.js'
import { UpdateInProgressError, type Hub } from '../service/hub.js'
import { renderDashboardHtml } from './ui.js'

const MAX_BODY_BYTES = 64 * 1024
const TOKEN_HEADER = 'x-ash-token'
const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '[::1]']

const skillName = z.string().refine(isValidSkillName, '올바르지 않은 스킬 이름입니다')

const installSchema = z.object({
  entryId: z.string().min(1),
  scope: z.enum(['global', 'project']).default('global'),
  force: z.boolean().optional(),
  grantTools: z.boolean().optional(),
  namePrefix: z.string().regex(/^[a-z0-9-]*$/).optional(),
})
const uninstallSchema = z.object({ skillName, scope: z.enum(['global', 'project']).default('global') })

type Handler = (url: URL, body: unknown) => Promise<unknown>

export interface AppOptions {
  /** 테스트용. 생략하면 프로세스마다 무작위 토큰을 만든다. */
  readonly token?: string
}

/**
 * 로컬 전용 대시보드 서버. 브라우저의 다른 사이트가 이 API 를 호출하지 못하도록
 * Host/Origin 검사, JSON Content-Type 강제, HTML 에 심은 프로세스별 토큰을 요구한다.
 */
export function createApp(hub: Hub, options: AppOptions = {}): Server & { readonly token: string } {
  const token = options.token ?? randomBytes(24).toString('hex')
  const routes: Record<string, Handler> = {
    'GET /api/catalog': async (url) => {
      const q = url.searchParams.get('q') ?? ''
      const repo = url.searchParams.get('repo') ?? undefined
      const category = url.searchParams.get('category') ?? undefined
      const [entries, catalog] = await Promise.all([hub.search(q, { repo, category }), hub.catalog()])
      return { updatedAt: catalog.updatedAt, total: catalog.entries.length, entries }
    },
    'GET /api/installed': () => hub.installed(),
    'GET /api/sources': () => hub.sources(),
    'GET /api/preview': async (url) => ({ markdown: (await hub.preview(url.searchParams.get('entryId') ?? '')).markdown }),
    'POST /api/update': () => hub.update(),
    'POST /api/install': async (_url, body) => {
      const { path, skill } = await hub.install(installSchema.parse(body))
      return { path, name: skill.name }
    },
    'POST /api/uninstall': async (_url, body) => {
      const { skillName: name, scope } = uninstallSchema.parse(body)
      await hub.uninstall(name, scope)
      return { ok: true }
    },
    'POST /api/sources': async (_url, body) => hub.addSource(sourceSchema.parse(body)),
    'DELETE /api/sources': async (url) => hub.removeSource(url.searchParams.get('repo') ?? ''),
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const rejection = checkRequestOrigin(req, token)
      if (rejection) return sendJson(res, 403, { success: false, error: rejection })
      if (req.method === 'GET' && url.pathname === '/') return sendHtml(res, renderDashboardHtml(token))
      const handler = routes[`${req.method} ${url.pathname}`]
      if (!handler) return sendJson(res, 404, { success: false, error: 'Not found' })
      const data = await handler(url, await readJsonBody(req))
      return sendJson(res, 200, { success: true, data })
    } catch (error) {
      return sendError(res, error)
    }
  })
  return Object.assign(server, { token })
}

/** 반환값이 있으면 거부 사유. */
function checkRequestOrigin(req: IncomingMessage, token: string): string | undefined {
  const host = (req.headers.host ?? '').replace(/:\d+$/, '')
  if (!LOOPBACK_HOSTS.includes(host)) return `허용되지 않은 Host: ${host}`
  const origin = req.headers.origin
  if (origin !== undefined) {
    const originHost = safeHostOf(origin)
    if (originHost === undefined || !LOOPBACK_HOSTS.includes(originHost)) return `허용되지 않은 Origin: ${origin}`
  }
  if (req.method === 'GET') return undefined
  if (req.headers[TOKEN_HEADER] !== token) return '대시보드 토큰이 없거나 올바르지 않습니다'
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return 'Content-Type 은 application/json 이어야 합니다'
  return undefined
}

function safeHostOf(origin: string): string | undefined {
  try {
    return new URL(origin).hostname === '::1' ? '[::1]' : new URL(origin).hostname
  } catch {
    return undefined
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let received = 0
    req.on('data', (chunk: Buffer) => {
      received += chunk.length
      if (received <= MAX_BODY_BYTES) chunks.push(chunk)
    })
    req.on('error', reject)
    req.on('end', () => {
      if (received > MAX_BODY_BYTES) return reject(new BodyTooLargeError())
      const text = Buffer.concat(chunks).toString('utf8')
      try {
        resolve(text.length === 0 ? undefined : (JSON.parse(text) as unknown))
      } catch (error) {
        reject(error)
      }
    })
  })
}

class BodyTooLargeError extends Error {
  constructor() {
    super(`요청 본문이 ${MAX_BODY_BYTES} 바이트를 넘습니다`)
  }
}

function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof ZodError) {
    return sendJson(res, 400, { success: false, error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') })
  }
  if (error instanceof SyntaxError || error instanceof BodyTooLargeError) {
    return sendJson(res, 400, { success: false, error: error.message })
  }
  if (error instanceof UpdateInProgressError) return sendJson(res, 409, { success: false, error: error.message })
  const message = error instanceof Error ? error.message : String(error)
  return sendJson(res, 500, { success: false, error: message })
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(payload))
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
  })
  res.end(html)
}
