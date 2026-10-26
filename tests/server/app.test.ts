import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { request } from 'node:http'
import { createApp } from '../../src/server/app.js'
import { createHub } from '../../src/service/hub.js'
import { resolvePaths } from '../../src/config/paths.js'
import { writeSources } from '../../src/config/sources-store.js'
import type { GitHubClient } from '../../src/github/client.js'

const files: Record<string, string> = {
  'agents/good.md': '---\nname: good\ndescription: Does good\ntools: Read\n---\nYou are good.',
}
const client: GitHubClient = {
  listBlobPaths: async () => Object.keys(files),
  fetchRaw: async (_r, _ref, p) => files[p] ?? Promise.reject(new Error('missing')),
  defaultBranch: async () => 'main',
  resolveCommit: async () => 'sha1',
}

let base = ''
const server = (() => {
  const root = mkdtempSync(join(tmpdir(), 'ash-srv-'))
  const paths = resolvePaths({ HOME: root, ASH_DATA_DIR: join(root, 'data') })
  void writeSources(paths.sourcesFile, [{ repo: 'o/r', ref: '', agentGlobs: [] }])
  return createApp(createHub(client, paths), { token: 'testtoken' })
})()

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Ash-Token': 'testtoken', ...headers }, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, json: (await res.json()) as { success: boolean; data?: unknown; error?: string } }
}

const rawStatus = (path: string, headers: Record<string, string>) =>
  new Promise<number>((resolve, reject) => {
    const { port } = server.address() as AddressInfo
    request({ host: '127.0.0.1', port, path, headers }, (res) => { res.resume(); resolve(res.statusCode ?? 0) }).on('error', reject).end()
  })

describe('dashboard server', () => {
  it('serves the HTML dashboard at /', async () => {
    const res = await fetch(base + '/')
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('Agent Skill Hub')
    expect(html).toContain('data-token="testtoken"')
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
  })

  it('blocks cross-site requests: bad Host, bad Origin, missing token, non-JSON body', async () => {
    const badHost = await rawStatus('/api/installed', { Host: 'evil.example' })
    expect(badHost).toBe(403)
    const badOrigin = await fetch(base + '/api/installed', { headers: { Origin: 'https://evil.example' } })
    expect(badOrigin.status).toBe(403)
    const okOrigin = await fetch(base + '/api/installed', { headers: { Origin: `http://127.0.0.1:1234` } })
    expect(okOrigin.status).toBe(200)
    const noToken = await fetch(base + '/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    expect(noToken.status).toBe(403)
    const textBody = await fetch(base + '/api/update', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Ash-Token': 'testtoken' }, body: '{}' })
    expect(textBody.status).toBe(403)
  })

  it('rejects oversized bodies and malformed JSON with 400', async () => {
    const big = await call('POST', '/api/install', { entryId: 'x'.repeat(70 * 1024) })
    expect(big.status).toBe(400)
    const res = await fetch(base + '/api/install', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ash-Token': 'testtoken' }, body: '{bad' })
    expect(res.status).toBe(400)
  })

  it('updates, searches, previews, installs and uninstalls through the API', async () => {
    const update = await call('POST', '/api/update')
    expect(update.json.success).toBe(true)
    const catalog = await call('GET', '/api/catalog?q=good')
    expect((catalog.json.data as { entries: unknown[] }).entries).toHaveLength(1)
    const preview = await call('GET', '/api/preview?entryId=good')
    expect((preview.json.data as { markdown: string }).markdown).toContain('name: good')
    const install = await call('POST', '/api/install', { entryId: 'good', scope: 'global' })
    expect(install.json).toMatchObject({ success: true, data: { name: 'good' } })
    const installed = await call('GET', '/api/installed')
    expect(installed.json.data).toHaveLength(1)
    const uninstall = await call('POST', '/api/uninstall', { skillName: 'good', scope: 'global' })
    expect(uninstall.json.success).toBe(true)
  })

  it('validates input and returns ApiResponse errors', async () => {
    const bad = await call('POST', '/api/install', { scope: 'global' })
    expect(bad.status).toBe(400)
    expect(bad.json.success).toBe(false)
    const traversal = await call('POST', '/api/uninstall', { skillName: '../x' })
    expect(traversal.status).toBe(400)
    const unknown = await call('POST', '/api/install', { entryId: 'does-not-exist' })
    expect(unknown.status).toBe(500)
    const badSource = await call('POST', '/api/sources', { repo: 'nope' })
    expect(badSource.status).toBe(400)
    const missing = await call('GET', '/api/nothing')
    expect(missing.status).toBe(404)
  })

  it('manages sources through the API', async () => {
    const added = await call('POST', '/api/sources', { repo: 'x/y' })
    expect((added.json.data as unknown[]).length).toBe(2)
    const removed = await call('DELETE', '/api/sources?repo=x/y')
    expect((removed.json.data as unknown[]).length).toBe(1)
  })
})
