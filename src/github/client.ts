import { z } from 'zod'

export interface GitHubClient {
  listBlobPaths(repo: string, ref: string): Promise<readonly string[]>
  fetchRaw(repo: string, ref: string, path: string): Promise<string>
  defaultBranch(repo: string): Promise<string>
  resolveCommit(repo: string, ref: string): Promise<string>
}

export interface GitHubClientOptions {
  readonly fetch?: typeof globalThis.fetch
  readonly token?: string
  readonly apiBase?: string
  readonly rawBase?: string
  readonly timeoutMs?: number
}

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const REF_PATTERN = /^[A-Za-z0-9._/-]+$/
const DEFAULT_TIMEOUT_MS = 15_000
const FALLBACK_BRANCH = 'main'

const treeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })).default([]),
  truncated: z.boolean().optional(),
})
const repoSchema = z.object({ default_branch: z.string().optional() })
const commitSchema = z.object({ sha: z.string() })

export function createGitHubClient(options: GitHubClientOptions = {}): GitHubClient {
  const doFetch = options.fetch ?? globalThis.fetch
  const token = options.token ?? process.env['GITHUB_TOKEN']
  const apiBase = options.apiBase ?? 'https://api.github.com'
  const rawBase = options.rawBase ?? 'https://raw.githubusercontent.com'
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'agent-skill-hub',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  async function request(url: string): Promise<Response> {
    const response = await doFetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const hint = response.status === 403 || response.status === 429 ? ' GitHub API 제한일 수 있습니다. GITHUB_TOKEN 을 설정하세요.' : ''
      throw new Error(`GitHub 요청 실패 (${response.status}) ${url}: ${detail.slice(0, 200)}${hint}`)
    }
    return response
  }

  async function requestJson<S extends z.ZodTypeAny>(url: string, schema: S): Promise<z.infer<S>> {
    const response = await request(url)
    const result = schema.safeParse(await response.json())
    if (!result.success) throw new Error(`GitHub 응답 형식이 예상과 다릅니다: ${url}`)
    return result.data
  }

  return {
    async listBlobPaths(repo, ref) {
      assertRepo(repo)
      assertRef(ref)
      const data = await requestJson(`${apiBase}/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, treeSchema)
      if (data.truncated) throw new Error(`레포 ${repo} 의 파일 트리가 너무 커서 잘렸습니다. agentGlobs 로 범위를 좁히세요.`)
      return data.tree.filter((node) => node.type === 'blob').map((node) => node.path)
    },
    async fetchRaw(repo, ref, path) {
      assertRepo(repo)
      assertRef(ref)
      const encodedPath = path.split('/').map(encodeURIComponent).join('/')
      const response = await request(`${rawBase}/${repo}/${encodeURIComponent(ref)}/${encodedPath}`)
      return response.text()
    },
    async defaultBranch(repo) {
      assertRepo(repo)
      const data = await requestJson(`${apiBase}/repos/${repo}`, repoSchema)
      return data.default_branch ?? FALLBACK_BRANCH
    },
    async resolveCommit(repo, ref) {
      assertRepo(repo)
      assertRef(ref)
      const data = await requestJson(`${apiBase}/repos/${repo}/commits/${encodeURIComponent(ref)}`, commitSchema)
      return data.sha
    },
  }
}

export function isValidRef(ref: string): boolean {
  return REF_PATTERN.test(ref) && !ref.split('/').includes('..')
}

function assertRepo(repo: string): void {
  if (!REPO_PATTERN.test(repo)) {
    throw new Error(`레포 식별자는 owner/repo 형식이어야 합니다: "${repo}"`)
  }
}

function assertRef(ref: string): void {
  if (!isValidRef(ref)) throw new Error(`올바르지 않은 ref 입니다: "${ref}"`)
}
