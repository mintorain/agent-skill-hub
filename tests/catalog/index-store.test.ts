import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readCatalog, writeCatalog, mergeCatalog } from '../../src/catalog/index-store.js'
import type { Catalog, CatalogEntry } from '../../src/core/types.js'

const entry = (id: string, repo = 'o/r'): CatalogEntry => ({ id, skillName: id, originalName: id, description: 'd', tools: [], repo, path: `${id}.md`, ref: 'main' })

describe('index-store', () => {
  it('returns an empty catalog when the file does not exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ash-'))
    const catalog = await readCatalog(join(dir, 'index.json'))
    expect(catalog.entries).toEqual([])
  })

  it('round-trips a catalog through disk', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ash-'))
    const file = join(dir, 'nested', 'index.json')
    const catalog: Catalog = { version: 1, updatedAt: 'now', entries: [entry('a')] }
    await writeCatalog(file, catalog)
    await expect(readCatalog(file)).resolves.toEqual(catalog)
  })

  it('rejects a corrupted catalog file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ash-'))
    const file = join(dir, 'index.json')
    await writeCatalog(file, { version: 1, updatedAt: 'x', entries: [] })
    const { writeFile } = await import('node:fs/promises')
    await writeFile(file, '{"version": 2}')
    await expect(readCatalog(file)).rejects.toThrow(/카탈로그/)
  })

  it('mergeCatalog replaces entries of the same repo and keeps others', () => {
    const existing: Catalog = { version: 1, updatedAt: 'old', entries: [entry('a'), entry('z', 'x/y')] }
    const merged = mergeCatalog(existing, 'o/r', [entry('b')])
    expect(merged.entries.map((e) => e.id).sort()).toEqual(['b', 'z'])
    expect(existing.entries).toHaveLength(2)
  })
})
