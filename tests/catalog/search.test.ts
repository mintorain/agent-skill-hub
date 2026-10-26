import { describe, it, expect } from 'vitest'
import { searchCatalog } from '../../src/catalog/search.js'
import type { CatalogEntry } from '../../src/core/types.js'

const entries: CatalogEntry[] = [
  { id: 'a', skillName: 'backend-architect', originalName: 'backend-architect', description: 'Designs scalable APIs', tools: ['Read'], repo: 'o/r', path: 'agents/b.md', ref: 'main', category: 'backend' },
  { id: 'b', skillName: 'security-auditor', originalName: 'security-auditor', description: 'Finds vulnerabilities', tools: [], repo: 'o/r', path: 'agents/s.md', ref: 'main', category: 'security' },
  { id: 'c', skillName: 'frontend-designer', originalName: 'frontend-designer', description: 'Builds UI and API clients', tools: [], repo: 'x/y', path: 'agents/f.md', ref: 'main' },
]

describe('searchCatalog', () => {
  it('matches name, description and category case-insensitively', () => {
    expect(searchCatalog(entries, 'API').map((e) => e.id)).toEqual(['a', 'c'])
    expect(searchCatalog(entries, 'SECURITY').map((e) => e.id)).toEqual(['b'])
  })
  it('ranks name matches above description matches', () => {
    expect(searchCatalog(entries, 'frontend')[0]?.id).toBe('c')
  })
  it('filters by repo when given', () => {
    expect(searchCatalog(entries, '', { repo: 'x/y' }).map((e) => e.id)).toEqual(['c'])
  })
  it('returns everything for an empty query', () => {
    expect(searchCatalog(entries, '')).toHaveLength(3)
  })
})
