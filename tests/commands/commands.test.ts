import { describe, it, expect, vi } from 'vitest'
import { Command } from 'commander'
import { PassThrough } from 'node:stream'
import { registerCommands } from '../../src/commands/register.js'
import { createLogger } from '../../src/util/logger.js'
import type { Hub } from '../../src/service/hub.js'

function makeHub(): Hub {
  return {
    update: vi.fn(async () => [{ repo: 'o/r', ref: 'abcdef1234', indexed: 2, skipped: 0 }]),
    catalog: vi.fn(async () => ({ version: 1 as const, updatedAt: 'x', entries: [] })),
    search: vi.fn(async () => [{ id: 'o/r:a.md', skillName: 'alpha', originalName: 'alpha', description: 'd', tools: [], repo: 'o/r', path: 'a.md', ref: 'x' }]),
    preview: vi.fn(async () => ({ skill: { name: 'alpha', description: 'd', allowedTools: [], metadata: {}, body: '' }, markdown: '---\nname: alpha\n---\n' })),
    install: vi.fn(async ({ entryId }) => {
      if (entryId === 'bad') throw new Error('nope')
      return { path: '/p/SKILL.md', skill: { name: entryId, description: 'd', allowedTools: [], metadata: {}, body: '' } }
    }),
    uninstall: vi.fn(async () => undefined),
    installed: vi.fn(async () => []),
    sources: vi.fn(async () => [{ repo: 'o/r', ref: '', agentGlobs: [] }]),
    addSource: vi.fn(async () => []),
    removeSource: vi.fn(async () => []),
  }
}

async function run(args: string[], hub = makeHub()) {
  const out = new PassThrough(); const err = new PassThrough()
  const chunks: string[] = []; const errors: string[] = []
  out.on('data', (c) => chunks.push(String(c))); err.on('data', (c) => errors.push(String(c)))
  const program = new Command().exitOverride()
  registerCommands(program, hub, createLogger(out, err))
  await program.parseAsync(['node', 'ash', ...args])
  return { out: chunks.join(''), err: errors.join(''), hub }
}

describe('cli commands', () => {
  it('update prints a report per source', async () => {
    const { out } = await run(['update'])
    expect(out).toContain('[완료] o/r@abcdef1')
  })
  it('search prints entries and validates --limit', async () => {
    const { out } = await run(['search', 'a', '-n', '5'])
    expect(out).toContain('alpha')
    await expect(run(['search', 'a', '-n', 'abc'])).rejects.toThrow(/양의 정수/)
  })
  it('install continues after a failure and reports it', async () => {
    const { out, err, hub } = await run(['install', 'bad', 'good', '--project', '--prefix', 'gh'])
    expect(err).toContain('bad: nope')
    expect(out).toContain('[설치] good')
    expect(hub.install).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'project', namePrefix: 'gh' }))
    process.exitCode = 0
  })
  it('remove, list, preview and sources commands delegate to the hub', async () => {
    const { out, hub } = await run(['remove', 'alpha'])
    expect(hub.uninstall).toHaveBeenCalledWith('alpha', 'global')
    expect(out).toContain('[제거] alpha')
    expect((await run(['list'])).out).toContain('설치된 스킬이 없습니다')
    expect((await run(['preview', 'alpha'])).out).toContain('name: alpha')
    expect((await run(['sources'])).out).toContain('o/r')
    const added = await run(['sources', 'add', 'x/y', '-g', 'agents/*.md'])
    expect(added.hub.addSource).toHaveBeenCalledWith({ repo: 'x/y', ref: '', agentGlobs: ['agents/*.md'] })
  })
  it('serve refuses non-loopback hosts and bad ports', async () => {
    await expect(run(['serve', '--host', '0.0.0.0'])).rejects.toThrow(/루프백/)
    await expect(run(['serve', '-p', '99999'])).rejects.toThrow(/포트/)
  })
})
