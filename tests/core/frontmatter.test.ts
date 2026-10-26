import { describe, it, expect } from 'vitest'
import { parseFrontmatter, serializeFrontmatter } from '../../src/core/frontmatter.js'

describe('parseFrontmatter', () => {
  it('splits YAML frontmatter and body', () => {
    const doc = '---\nname: foo\ndescription: bar\n---\n\nBody text\n'
    const result = parseFrontmatter(doc)
    expect(result.data).toEqual({ name: 'foo', description: 'bar' })
    expect(result.body).toBe('Body text\n')
  })

  it('returns empty data when no frontmatter is present', () => {
    const result = parseFrontmatter('# Just markdown\n')
    expect(result.data).toEqual({})
    expect(result.body).toBe('# Just markdown\n')
  })

  it('handles CRLF line endings', () => {
    const result = parseFrontmatter('---\r\nname: x\r\n---\r\nhi')
    expect(result.data).toEqual({ name: 'x' })
    expect(result.body).toBe('hi')
  })

  it('falls back to lenient key: value parsing when strict YAML fails', () => {
    const doc = '---\nname: x\ndescription: Use when... Examples: <example>\nuser: "hi"\n</example>\n---\nbody'
    const result = parseFrontmatter(doc)
    expect(result.data['name']).toBe('x')
    expect(String(result.data['description'])).toContain('Examples: <example>')
  })

  it('throws a descriptive error when nothing can be parsed', () => {
    expect(() => parseFrontmatter('---\n[unclosed\n---\nbody')).toThrow(/프론트매터/)
  })
})

describe('serializeFrontmatter', () => {
  it('round-trips data and body', () => {
    const text = serializeFrontmatter({ name: 'a', list: ['x', 'y'] }, 'Hello\n')
    const back = parseFrontmatter(text)
    expect(back.data).toEqual({ name: 'a', list: ['x', 'y'] })
    expect(back.body).toBe('Hello\n')
  })

  it('omits undefined values', () => {
    const text = serializeFrontmatter({ name: 'a', missing: undefined }, '')
    expect(text).not.toContain('missing')
  })
})
