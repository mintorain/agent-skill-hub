import { describe, it, expect } from 'vitest'
import { convertAgentToSkill, cleanDescription } from '../../src/core/skill-converter.js'
import type { AgentDefinition } from '../../src/core/types.js'

const agent: AgentDefinition = {
  name: 'Backend Architect',
  description: 'Designs scalable APIs. Use PROACTIVELY when creating backend services.',
  tools: ['Read', 'Grep', 'Edit'],
  model: 'sonnet',
  systemPrompt: 'You are a backend architect.\n\n## Purpose\nDesign systems.',
}
const source = { repo: 'wshobson/agents', path: 'plugins/backend/agents/backend-architect.md', ref: 'abc' }

describe('convertAgentToSkill', () => {
  it('produces a spec-compliant skill name and keeps the description', () => {
    const skill = convertAgentToSkill(agent, source)
    expect(skill.name).toBe('backend-architect')
    expect(skill.description).toContain('Designs scalable APIs')
  })

  it('does not grant allowed-tools by default but records them in metadata', () => {
    const skill = convertAgentToSkill(agent, source)
    expect(skill.allowedTools).toEqual([])
    expect(skill.metadata['preferred-tools']).toBe('Read Grep Edit')
    expect(skill.metadata).toMatchObject({ 'source-repo': 'wshobson/agents', 'source-path': source.path, 'source-ref': 'abc', 'original-name': 'Backend Architect', model: 'sonnet' })
  })

  it('grants allowed-tools only when grantTools is set', () => {
    expect(convertAgentToSkill(agent, source, { grantTools: true }).allowedTools).toEqual(['Read', 'Grep', 'Edit'])
  })

  it('wraps the system prompt in a role-adoption body', () => {
    const skill = convertAgentToSkill(agent, source)
    expect(skill.body).toContain('# Backend Architect')
    expect(skill.body).toContain('You are a backend architect.')
    expect(skill.body).toMatch(/adopt/i)
  })

  it('honours a name prefix option and does not mutate the input', () => {
    const frozen = Object.freeze({ ...agent, tools: Object.freeze([...agent.tools]) as string[] })
    expect(convertAgentToSkill(frozen, source, { namePrefix: 'gh' }).name).toBe('gh-backend-architect')
  })
})

describe('cleanDescription', () => {
  it('strips example blocks, leftover tags and truncates to 1024 chars', () => {
    const noisy = 'Short intro. Examples:\\n\\n<example>\\nuser: "x"\\n</example><commentary>hidden</commentary>' + 'z'.repeat(2000)
    const cleaned = cleanDescription(noisy)
    expect(cleaned.startsWith('Short intro.')).toBe(true)
    expect(cleaned).not.toMatch(/<[a-z]+>/)
    expect(cleaned).not.toContain('hidden')
    expect(cleaned.length).toBeLessThanOrEqual(1024)
  })
})
