import { describe, it, expect } from 'vitest'
import { renderSkillMarkdown } from '../../src/core/skill-writer.js'
import { parseFrontmatter } from '../../src/core/frontmatter.js'
import type { SkillDefinition } from '../../src/core/types.js'

const skill: SkillDefinition = {
  name: 'backend-architect',
  description: 'Designs APIs.',
  license: 'MIT',
  allowedTools: ['Read', 'Grep'],
  metadata: { 'source-repo': 'wshobson/agents', model: 'sonnet' },
  body: '# Backend Architect\n\nYou are an architect.\n',
}

describe('renderSkillMarkdown', () => {
  it('writes frontmatter matching the Agent Skills spec', () => {
    const text = renderSkillMarkdown(skill)
    const { data, body } = parseFrontmatter(text)
    expect(data).toMatchObject({
      name: 'backend-architect',
      description: 'Designs APIs.',
      license: 'MIT',
      'allowed-tools': 'Read Grep',
      metadata: { 'source-repo': 'wshobson/agents', model: 'sonnet' },
    })
    expect(body).toContain('# Backend Architect')
  })

  it('omits allowed-tools and license when empty', () => {
    const text = renderSkillMarkdown({ ...skill, allowedTools: [], license: undefined })
    expect(text).not.toContain('allowed-tools')
    expect(text).not.toContain('license')
  })
})
