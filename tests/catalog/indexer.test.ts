import { describe, it, expect } from 'vitest'
import { indexSource } from '../../src/catalog/indexer.js'
import type { GitHubClient } from '../../src/github/client.js'

const files: Record<string, string> = {
  'agents/good.md': '---\nname: good-agent\ndescription: Does good things\ntools: Read, Grep\nmodel: sonnet\n---\nYou are good.',
  'agents/bad.md': '# not an agent',
  'agents/security/auditor.md': '---\nname: auditor\ndescription: Audits\n---\nYou audit.',
}

const client: GitHubClient = {
  listBlobPaths: async () => Object.keys(files).concat(['README.md']),
  fetchRaw: async (_repo, _ref, path) => files[path] ?? Promise.reject(new Error('network down')),
  defaultBranch: async () => 'main',
  resolveCommit: async () => 'sha123',
}

describe('indexSource', () => {
  it('turns valid agent files into catalog entries pinned to a commit and skips invalid ones', async () => {
    const result = await indexSource(client, { repo: 'o/r', ref: '', agentGlobs: [] })
    expect(result.ref).toBe('sha123')
    expect(result.entries.map((e) => e.skillName).sort()).toEqual(['auditor', 'good-agent'])
    expect(result.skipped).toEqual(['agents/bad.md'])
    const good = result.entries.find((e) => e.skillName === 'good-agent')
    expect(good).toMatchObject({ tools: ['Read', 'Grep'], model: 'sonnet', repo: 'o/r', path: 'agents/good.md', ref: 'sha123', id: 'o/r:agents/good.md' })
    expect(result.entries.find((e) => e.skillName === 'auditor')?.category).toBe('security')
  })

  it('reports progress with a completed count', async () => {
    const calls: number[] = []
    await indexSource(client, { repo: 'o/r', ref: 'main', agentGlobs: [] }, (_repo, completed) => calls.push(completed))
    expect(calls.sort()).toEqual([1, 2, 3])
  })

  it('propagates network errors instead of silently dropping entries', async () => {
    const flaky: GitHubClient = { ...client, listBlobPaths: async () => ['agents/missing.md'] }
    await expect(indexSource(flaky, { repo: 'o/r', ref: 'main', agentGlobs: [] })).rejects.toThrow(/network down/)
  })
})
