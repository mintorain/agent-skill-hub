import { describe, it, expect } from 'vitest'
import { addSource, removeSource } from '../../src/config/sources-store.js'

describe('sources-store', () => {
  it('validates repo and ref input', () => {
    expect(() => addSource([], { repo: 'nope' })).toThrow(/owner\/repo/)
    expect(() => addSource([], { repo: 'o/r', ref: '../x' })).toThrow(/ref/)
    expect(addSource([], { repo: 'o/r' })).toEqual([{ repo: 'o/r', ref: '', agentGlobs: [] }])
  })
  it('rejects duplicates and unknown removals', () => {
    const sources = addSource([], { repo: 'o/r' })
    expect(() => addSource(sources, { repo: 'o/r' })).toThrow(/이미/)
    expect(() => removeSource(sources, 'x/y')).toThrow(/등록되어 있지/)
    expect(removeSource(sources, 'o/r')).toEqual([])
  })
})
