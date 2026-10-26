import { parseAgentMarkdown } from '../core/agent-parser.js'
import { toSkillName } from '../core/skill-name.js'
import { cleanDescription } from '../core/skill-converter.js'
import type { CatalogEntry, SourceRepo } from '../core/types.js'
import type { GitHubClient } from '../github/client.js'
import { inferCategory, selectAgentCandidates } from '../github/discover.js'

export interface IndexResult {
  readonly repo: string
  readonly ref: string
  readonly entries: readonly CatalogEntry[]
  readonly skipped: readonly string[]
}

export type ProgressListener = (repo: string, completed: number, total: number) => void

/** raw.githubusercontent.com 은 API 제한이 느슨하지만 과도한 동시 요청을 피하기 위한 상한. */
const FETCH_CONCURRENCY = 8

/**
 * 소스 레포 하나를 크롤링해 카탈로그 항목으로 만든다. 브랜치는 커밋 SHA 로 고정하므로
 * 미리보기와 설치가 같은 내용을 가리킨다. 파싱 실패 파일은 skipped 에, 네트워크 오류는 예외로 올린다.
 */
export async function indexSource(
  client: GitHubClient,
  source: SourceRepo,
  onProgress?: ProgressListener,
): Promise<IndexResult> {
  const branch = source.ref || (await client.defaultBranch(source.repo))
  const ref = await client.resolveCommit(source.repo, branch)
  const paths = await client.listBlobPaths(source.repo, ref)
  const candidates = selectAgentCandidates(paths, source.agentGlobs)

  const results = await mapWithConcurrency(
    candidates,
    FETCH_CONCURRENCY,
    async (path) => ({ path, entry: toEntry(await client.fetchRaw(source.repo, ref, path), source.repo, ref, path) }),
    (completed) => onProgress?.(source.repo, completed, candidates.length),
  )

  return {
    repo: source.repo,
    ref,
    entries: results.flatMap(({ entry }) => (entry ? [entry] : [])),
    skipped: results.filter(({ entry }) => entry === undefined).map(({ path }) => path),
  }
}

function toEntry(text: string, repo: string, ref: string, path: string): CatalogEntry | undefined {
  try {
    const agent = parseAgentMarkdown(text)
    const category = inferCategory(path)
    return {
      id: `${repo}:${path}`,
      skillName: toSkillName(agent.name),
      originalName: agent.name,
      description: cleanDescription(agent.description),
      tools: agent.tools,
      ...(agent.model ? { model: agent.model } : {}),
      repo,
      path,
      ref,
      ...(category ? { category } : {}),
    }
  } catch {
    return undefined
  }
}

/** 결과는 입력 순서를 유지하고, 항목이 끝날 때마다 누적 완료 수를 알린다. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  onDone: (completed: number) => void,
): Promise<readonly R[]> {
  const results: R[] = new Array<R>(items.length)
  const queue = items.map((item, index) => ({ item, index }))
  const counter = { completed: 0 }
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      results[next.index] = await worker(next.item)
      counter.completed += 1
      onDone(counter.completed)
    }
  })
  await Promise.all(runners)
  return results
}
