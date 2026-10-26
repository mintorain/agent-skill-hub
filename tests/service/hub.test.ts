import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHub, type Hub } from '../../src/service/hub.js'
import { resolvePaths } from '../../src/config/paths.js'
import { writeSources } from '../../src/config/sources-store.js'
import type { GitHubClient } from '../../src/github/client.js'

const files: Record<string, string> = {
  'agents/good.md': '---\nname: Good Agent\ndescription: Does good things\ntools: Read\n---\nYou are good.',
  'agents/other.md': '---\nname: other\ndescription: Other stuff\n---\nYou are other.',
  'agents/dup/good.md': '---\nname: good-agent\ndescription: A duplicate\n---\nYou are a copy.',
}

const client: GitHubClient = {
  listBlobPaths: async () => Object.keys(files),
  fetchRaw: async (_r, _ref, path) => files[path] ?? Promise.reject(new Error('missing')),
  defaultBranch: async () => 'main',
  resolveCommit: async () => 'sha1',
}

describe('hub', () => {
  let hub: Hub
  let root: string

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'ash-hub-'))
    const paths = resolvePaths({ HOME: root, ASH_DATA_DIR: join(root, 'data') }, join(root, 'proj'))
    await writeSources(paths.sourcesFile, [{ repo: 'o/r', ref: '', agentGlobs: [] }])
    hub = createHub(client, paths)
  })

  it('update indexes sources and search finds entries', async () => {
    const reports = await hub.update()
    expect(reports).toEqual([{ repo: 'o/r', ref: 'sha1', indexed: 3, skipped: 0 }])
    const hits = await hub.search('good')
    expect(hits.map((e) => e.skillName)).toEqual(['good-agent', 'good-agent'])
  })

  it('install writes to the global skills dir and installed() lists it', async () => {
    await hub.update()
    const { path, skill } = await hub.install({ entryId: 'o/r:agents/good.md', scope: 'global', grantTools: true })
    expect(path).toBe(join(root, '.claude', 'skills', 'good-agent', 'SKILL.md'))
    expect(skill.allowedTools).toEqual(['Read'])
    expect((await hub.installed()).map((s) => s.skillName)).toEqual(['good-agent'])
    await hub.uninstall('good-agent', 'global')
    expect(existsSync(path)).toBe(false)
  })

  it('install by skillName into project scope', async () => {
    await hub.update()
    const { path } = await hub.install({ entryId: 'other', scope: 'project' })
    expect(path).toBe(join(root, 'proj', '.claude', 'skills', 'other', 'SKILL.md'))
  })

  it('preview returns rendered SKILL.md without writing', async () => {
    await hub.update()
    const { markdown } = await hub.preview('o/r:agents/good.md', 'gh')
    expect(markdown).toContain('name: gh-good-agent')
    expect(await hub.installed()).toEqual([])
  })

  it('reports source errors without aborting the whole update and keeps old entries', async () => {
    await hub.update()
    const failing: GitHubClient = { ...client, listBlobPaths: async () => { throw new Error('boom') } }
    const paths = resolvePaths({ HOME: root, ASH_DATA_DIR: join(root, 'data') })
    const reports = await createHub(failing, paths).update()
    expect(reports[0]?.error).toMatch(/boom/)
    expect((await hub.catalog()).entries).toHaveLength(3)
  })

  it('rejects a concurrent update', async () => {
    const first = hub.update()
    await expect(hub.update()).rejects.toThrow(/진행 중/)
    await first
  })

  it('prunes catalog entries of removed sources on update', async () => {
    await hub.update()
    await hub.addSource({ repo: 'x/y', ref: '', agentGlobs: [] })
    await hub.update()
    await hub.removeSource('o/r')
    await hub.update()
    expect((await hub.catalog()).entries.every((e) => e.repo === 'x/y')).toBe(true)
  })

  it('manages sources', async () => {
    const added = await hub.addSource({ repo: 'x/y', ref: '', agentGlobs: [] })
    expect(added.map((s) => s.repo)).toEqual(['o/r', 'x/y'])
    await expect(hub.addSource({ repo: 'x/y', ref: '', agentGlobs: [] })).rejects.toThrow(/이미/)
    const removed = await hub.removeSource('x/y')
    expect(removed.map((s) => s.repo)).toEqual(['o/r'])
  })

  it('install by ambiguous skill name lists the candidate ids', async () => {
    await hub.update()
    await expect(hub.install({ entryId: 'good-agent', scope: 'global' })).rejects.toThrow(/o\/r:agents\/dup\/good\.md/)
  })

  it('install throws for unknown entries', async () => {
    await expect(hub.install({ entryId: 'nope', scope: 'global' })).rejects.toThrow(/찾을 수 없습니다/)
  })
})
