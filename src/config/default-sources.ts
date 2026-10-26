import type { SourceRepo } from '../core/types.js'

/** GitHub 조사로 선정한 기본 에이전트 소스. 모두 Claude Code 서브에이전트 형식(.md + 프론트매터)을 쓴다. */
export const DEFAULT_SOURCES: readonly SourceRepo[] = [
  { repo: 'wshobson/agents', ref: '', agentGlobs: ['plugins/*/agents/*.md'] },
  { repo: 'iannuttall/claude-agents', ref: '', agentGlobs: ['agents/*.md'] },
  { repo: 'lst97/claude-code-sub-agents', ref: '', agentGlobs: ['agents/**/*.md'] },
  { repo: 'VoltAgent/awesome-claude-code-subagents', ref: '', agentGlobs: ['categories/**/*.md'] },
]
