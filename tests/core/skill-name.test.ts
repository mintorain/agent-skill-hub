import { describe, it, expect } from 'vitest'
import { toSkillName, isValidSkillName } from '../../src/core/skill-name.js'

describe('toSkillName', () => {
  it('lowercases and replaces invalid characters with hyphens', () => {
    expect(toSkillName('Backend Architect!')).toBe('backend-architect')
  })
  it('collapses consecutive hyphens and trims edge hyphens', () => {
    expect(toSkillName('--foo__bar--')).toBe('foo-bar')
  })
  it('truncates to 64 characters without trailing hyphen', () => {
    const long = 'a'.repeat(60) + '-bcdefgh'
    const name = toSkillName(long)
    expect(name.length).toBeLessThanOrEqual(64)
    expect(name.endsWith('-')).toBe(false)
  })
  it('applies an optional prefix', () => {
    expect(toSkillName('reviewer', 'agent')).toBe('agent-reviewer')
  })
  it('throws when nothing valid remains', () => {
    expect(() => toSkillName('!!!')).toThrow()
  })
})

describe('isValidSkillName', () => {
  it('accepts spec-compliant names', () => {
    expect(isValidSkillName('pdf-processing')).toBe(true)
  })
  it('rejects uppercase, edge hyphens, double hyphens, and long names', () => {
    expect(isValidSkillName('PDF')).toBe(false)
    expect(isValidSkillName('-pdf')).toBe(false)
    expect(isValidSkillName('pdf--x')).toBe(false)
    expect(isValidSkillName('a'.repeat(65))).toBe(false)
  })
})
