import { describe, it, expect } from 'vitest'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJsonFile, writeJsonFile, withFileLock } from '../../src/util/json-file.js'

describe('json-file', () => {
  it('writes atomically and leaves no temp files behind', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ash-json-'))
    const file = join(dir, 'x.json')
    await writeJsonFile(file, { a: 1 })
    expect(await readJsonFile(file)).toEqual({ a: 1 })
    expect(readdirSync(dir)).toEqual(['x.json'])
  })

  it('withFileLock serializes tasks on the same key', async () => {
    const order: string[] = []
    const slow = withFileLock('k', async () => { await new Promise((r) => setTimeout(r, 20)); order.push('slow') })
    const fast = withFileLock('k', async () => { order.push('fast') })
    await Promise.all([slow, fast])
    expect(order).toEqual(['slow', 'fast'])
  })

  it('withFileLock keeps working after a failed task', async () => {
    await expect(withFileLock('k2', async () => { throw new Error('x') })).rejects.toThrow('x')
    await expect(withFileLock('k2', async () => 'ok')).resolves.toBe('ok')
  })
})
