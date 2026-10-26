import { describe, it, expect } from 'vitest'
import { selectAgentCandidates, inferCategory } from '../../src/github/discover.js'

const paths = [
  'README.md',
  'CLAUDE.md',
  'agents/code-refactorer.md',
  'agents/security/auditor.md',
  'plugins/backend-development/agents/backend-architect.md',
  'plugins/backend-development/skills/x/SKILL.md',
  'plugins/backend-development/commands/do.md',
  'docs/guide.md',
  'src/index.ts',
]

describe('selectAgentCandidates', () => {
  it('keeps markdown files under agents directories by default', () => {
    expect(selectAgentCandidates(paths)).toEqual([
      'agents/code-refactorer.md',
      'agents/security/auditor.md',
      'plugins/backend-development/agents/backend-architect.md',
    ])
  })

  it('excludes well-known non-agent markdown files', () => {
    expect(selectAgentCandidates(['agents/README.md', 'agents/CLAUDE.md', 'agents/x.md'])).toEqual(['agents/x.md'])
  })

  it('supports custom glob patterns', () => {
    expect(selectAgentCandidates(paths, ['docs/*.md'])).toEqual(['docs/guide.md'])
  })
})

describe('inferCategory', () => {
  it('uses the directory between the agents root and the file', () => {
    expect(inferCategory('agents/security/auditor.md')).toBe('security')
    expect(inferCategory('plugins/backend-development/agents/backend-architect.md')).toBe('backend-development')
    expect(inferCategory('agents/x.md')).toBeUndefined()
  })
})
