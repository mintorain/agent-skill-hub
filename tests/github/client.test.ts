import { describe, it, expect, vi } from 'vitest'
import { createGitHubClient, isValidRef } from '../../src/github/client.js'

function fakeFetch(responses: Record<string, { status: number; body?: unknown; text?: string }>) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input)
    const match = Object.entries(responses).find(([key]) => url.includes(key))
    if (!match) return new Response('not found', { status: 404 })
    const [, res] = match
    return new Response(res.text ?? JSON.stringify(res.body), { status: res.status })
  })
}

describe('createGitHubClient', () => {
  it('fetches a recursive tree and returns blob paths with auth header', async () => {
    const fetch = fakeFetch({ '/git/trees/main': { status: 200, body: { tree: [{ path: 'a.md', type: 'blob' }, { path: 'dir', type: 'tree' }] } } })
    const client = createGitHubClient({ fetch, token: 'tok' })
    expect(await client.listBlobPaths('o/r', 'main')).toEqual(['a.md'])
    const [, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok')
  })

  it('fails loudly when the tree is truncated', async () => {
    const fetch = fakeFetch({ '/git/trees/main': { status: 200, body: { tree: [], truncated: true } } })
    await expect(createGitHubClient({ fetch }).listBlobPaths('o/r', 'main')).rejects.toThrow(/잘렸/)
  })

  it('fetches raw file content with encoded path segments', async () => {
    const fetch = fakeFetch({ 'raw.githubusercontent.com/o/r/abc123/dir/my%20file.md': { status: 200, text: 'hello' } })
    await expect(createGitHubClient({ fetch }).fetchRaw('o/r', 'abc123', 'dir/my file.md')).resolves.toBe('hello')
  })

  it('resolves the default branch and a commit sha', async () => {
    const fetch = fakeFetch({ '/repos/o/r/commits/develop': { status: 200, body: { sha: 'deadbeef' } }, '/repos/o/r': { status: 200, body: { default_branch: 'develop' } } })
    const client = createGitHubClient({ fetch })
    await expect(client.defaultBranch('o/r')).resolves.toBe('develop')
    await expect(client.resolveCommit('o/r', 'develop')).resolves.toBe('deadbeef')
  })

  it('throws with a token hint on 403', async () => {
    const fetch = fakeFetch({ '/git/trees/main': { status: 403, body: { message: 'rate limit' } } })
    await expect(createGitHubClient({ fetch }).listBlobPaths('o/r', 'main')).rejects.toThrow(/GITHUB_TOKEN/)
  })

  it('rejects malformed repo identifiers and refs', async () => {
    const client = createGitHubClient({ fetch: fakeFetch({}) })
    await expect(client.listBlobPaths('not-a-repo', 'main')).rejects.toThrow(/owner\/repo/)
    await expect(client.fetchRaw('o/r', '../../x/y/main', 'a.md')).rejects.toThrow(/ref/)
    expect(isValidRef('feature/x.1')).toBe(true)
    expect(isValidRef('a b')).toBe(false)
  })

  it('rejects unexpected response shapes', async () => {
    const fetch = fakeFetch({ '/repos/o/r/commits/main': { status: 200, body: { nope: 1 } } })
    await expect(createGitHubClient({ fetch }).resolveCommit('o/r', 'main')).rejects.toThrow(/형식/)
  })
})
