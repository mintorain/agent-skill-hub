/** GitHub 레포에서 읽어온 에이전트 정의 (Claude Code 서브에이전트 형식). */
export interface AgentDefinition {
  readonly name: string
  readonly description: string
  readonly tools: readonly string[]
  readonly model?: string
  readonly systemPrompt: string
}

/** 에이전트 파일의 출처. ref 는 갱신 시점에 해석한 커밋 SHA(또는 브랜치). */
export interface AgentSource {
  readonly repo: string
  readonly path: string
  readonly ref: string
}

/** agentskills.io 스펙을 따르는 스킬 정의. */
export interface SkillDefinition {
  readonly name: string
  readonly description: string
  readonly license?: string
  readonly compatibility?: string
  /** 비어 있지 않으면 `allowed-tools` 로 출력되어 권한 프롬프트 없이 도구를 쓰게 한다. 기본은 비움. */
  readonly allowedTools: readonly string[]
  readonly metadata: Readonly<Record<string, string>>
  readonly body: string
}

/** 카탈로그에 저장되는 에이전트 요약 항목. */
export interface CatalogEntry {
  readonly id: string
  readonly skillName: string
  readonly originalName: string
  readonly description: string
  readonly tools: readonly string[]
  readonly model?: string
  readonly repo: string
  readonly path: string
  readonly ref: string
  readonly category?: string
}

export interface Catalog {
  readonly version: 1
  readonly updatedAt: string
  readonly entries: readonly CatalogEntry[]
}

export interface SourceRepo {
  readonly repo: string
  readonly ref: string
  readonly agentGlobs: readonly string[]
}

export type InstallScope = 'global' | 'project'

export interface InstalledSkill {
  readonly skillName: string
  readonly entryId: string
  readonly scope: InstallScope
  readonly skillsDir: string
  readonly path: string
  readonly installedAt: string
}
