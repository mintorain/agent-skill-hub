import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installSkill, uninstallSkill } from '../../src/install/installer.js'
import { readRegistry } from '../../src/install/registry.js'
import type { SkillDefinition } from '../../src/core/types.js'

const skill: SkillDefinition = { name: 'demo-skill', description: 'Demo', allowedTools: [], metadata: { 'source-repo': 'o/r' }, body: '# Demo\n' }

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'ash-'))
  return { root, opts: { skillsDir: join(root, 'skills'), registryFile: join(root, 'installed.json'), scope: 'global' as const, entryId: 'o/r:x.md' } }
}

describe('installSkill', () => {
  it('writes SKILL.md into <skillsDir>/<name>/ and records it in the registry', async () => {
    const { opts } = setup()
    const result = await installSkill(skill, opts)
    expect(result.path).toBe(join(opts.skillsDir, 'demo-skill', 'SKILL.md'))
    expect(readFileSync(result.path, 'utf8')).toContain('name: demo-skill')
    const registry = await readRegistry(opts.registryFile)
    expect(registry.skills[0]).toMatchObject({ skillName: 'demo-skill', entryId: 'o/r:x.md', scope: 'global', skillsDir: opts.skillsDir })
  })

  it('refuses to overwrite an existing skill unless force is set', async () => {
    const { opts } = setup()
    await installSkill(skill, opts)
    await expect(installSkill(skill, opts)).rejects.toThrow(/이미 설치/)
    await expect(installSkill(skill, { ...opts, force: true })).resolves.toBeTruthy()
    expect((await readRegistry(opts.registryFile)).skills).toHaveLength(1)
  })

  it('keeps separate records for the same skill in different project dirs', async () => {
    const { root, opts } = setup()
    const a = { ...opts, scope: 'project' as const, skillsDir: join(root, 'a', '.claude', 'skills') }
    const b = { ...opts, scope: 'project' as const, skillsDir: join(root, 'b', '.claude', 'skills') }
    await installSkill(skill, a)
    await installSkill(skill, b)
    expect((await readRegistry(opts.registryFile)).skills).toHaveLength(2)
    await uninstallSkill('demo-skill', a)
    expect(existsSync(join(b.skillsDir, 'demo-skill', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(a.skillsDir, 'demo-skill'))).toBe(false)
  })

  it('concurrent installs do not lose registry records', async () => {
    const { opts } = setup()
    await Promise.all([installSkill(skill, opts), installSkill({ ...skill, name: 'other-skill' }, opts)])
    expect((await readRegistry(opts.registryFile)).skills).toHaveLength(2)
  })

  it('uninstallSkill removes the directory and the registry record', async () => {
    const { opts } = setup()
    const { path } = await installSkill(skill, opts)
    await uninstallSkill('demo-skill', opts)
    expect(existsSync(path)).toBe(false)
    expect((await readRegistry(opts.registryFile)).skills).toHaveLength(0)
  })

  it('rejects names that are not spec-compliant (no path traversal)', async () => {
    const { opts } = setup()
    await expect(uninstallSkill('../etc', opts)).rejects.toThrow(/올바르지 않은/)
    await expect(installSkill({ ...skill, name: '../x' }, opts)).rejects.toThrow(/올바르지 않은/)
  })

  it('uninstallSkill throws for unknown skills', async () => {
    const { opts } = setup()
    await expect(uninstallSkill('nope', opts)).rejects.toThrow(/설치되어 있지 않/)
  })
})
