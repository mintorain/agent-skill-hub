const DEFAULT_GLOBS: readonly string[] = ['agents/**/*.md', '**/agents/**/*.md']
const EXCLUDED_BASENAMES = new Set(['README.md', 'CLAUDE.md', 'AGENTS.md', 'CONTRIBUTING.md', 'SKILL.md', 'LICENSE.md', 'CHANGELOG.md'])

/** 레포 파일 경로 목록에서 에이전트 정의 후보(.md)를 고른다. */
export function selectAgentCandidates(paths: readonly string[], globs: readonly string[] = []): readonly string[] {
  const patterns = (globs.length > 0 ? globs : DEFAULT_GLOBS).map(globToRegExp)
  return paths.filter((path) => {
    if (!path.endsWith('.md')) return false
    const basename = path.split('/').pop() ?? path
    if (EXCLUDED_BASENAMES.has(basename)) return false
    return patterns.some((pattern) => pattern.test(path))
  })
}

/** `agents/<category>/x.md` 또는 `plugins/<category>/agents/x.md` 에서 카테고리를 추정한다. */
export function inferCategory(path: string): string | undefined {
  const segments = path.split('/')
  const agentsIndex = segments.lastIndexOf('agents')
  if (agentsIndex === -1) return undefined
  const between = segments.slice(agentsIndex + 1, -1)
  if (between.length > 0) return between[0]
  const parent = segments[agentsIndex - 1]
  return parent && parent !== 'plugins' ? parent : undefined
}

// 최소 glob 지원: "**/" (0개 이상의 디렉터리), "**" (임의 경로), "*" (세그먼트 내). 그 외 문자는 리터럴.
export function globToRegExp(glob: string): RegExp {
  const collapsed = glob.replace(/(\*\*\/)+/g, '**/')
  const tokens = collapsed.split(/(\*\*\/|\*\*|\*)/)
  const source = tokens
    .map((token) => {
      if (token === '**/') return '(?:.*/)?'
      if (token === '**') return '.*'
      if (token === '*') return '[^/]*'
      return token.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return new RegExp(`^${source}$`)
}
