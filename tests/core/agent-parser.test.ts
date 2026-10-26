import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseAgentMarkdown, isAgentDocument } from '../../src/core/agent-parser.js'

const sample = readFileSync(new URL('../fixtures/agent-sample.md', import.meta.url), 'utf8')

describe('parseAgentMarkdown', () => {
  it('parses name, description, tools, model and body', () => {
    const agent = parseAgentMarkdown(sample)
    expect(agent.name).toBe('code-refactorer')
    expect(agent.description).toContain('improve existing code structure')
    expect(agent.tools).toEqual(['Edit', 'MultiEdit', 'Write', 'Grep', 'Read'])
    expect(agent.model).toBe('sonnet')
    expect(agent.systemPrompt).toContain('senior software developer')
  })

  it('accepts tools given as a YAML list', () => {
    const agent = parseAgentMarkdown('---\nname: x\ndescription: y\ntools:\n  - Read\n  - Grep\n---\nbody')
    expect(agent.tools).toEqual(['Read', 'Grep'])
  })

  it('defaults tools to an empty list when absent', () => {
    const agent = parseAgentMarkdown('---\nname: x\ndescription: y\n---\nbody')
    expect(agent.tools).toEqual([])
  })

  it('throws when name or description is missing', () => {
    expect(() => parseAgentMarkdown('---\nname: x\n---\nbody')).toThrow(/description/)
    expect(() => parseAgentMarkdown('# README\nno frontmatter')).toThrow()
  })

  it('throws when body is empty', () => {
    expect(() => parseAgentMarkdown('---\nname: x\ndescription: y\n---\n   \n')).toThrow(/body/i)
  })
})

describe('isAgentDocument', () => {
  it('is true only for documents with name and description frontmatter and a body', () => {
    expect(isAgentDocument(sample)).toBe(true)
    expect(isAgentDocument('# README')).toBe(false)
    expect(isAgentDocument('---\nname: only\n---\nbody')).toBe(false)
  })
})
