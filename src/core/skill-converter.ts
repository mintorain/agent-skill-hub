import { toSkillName } from './skill-name.js'
import type { AgentDefinition, AgentSource, SkillDefinition } from './types.js'

const MAX_DESCRIPTION_LENGTH = 1024

export interface ConvertOptions {
  readonly namePrefix?: string
  readonly license?: string
  /**
   * true 이면 에이전트의 tools 를 `allowed-tools` 로 내보낸다. 스킬에서 allowed-tools 는
   * "권한 확인 없이 사용 가능" 을 뜻하므로 신뢰할 수 있는 소스에만 켜야 한다.
   */
  readonly grantTools?: boolean
}

/** 서브에이전트 정의를 agentskills.io 스펙의 스킬 정의로 변환한다. 입력은 변경하지 않는다. */
export function convertAgentToSkill(
  agent: AgentDefinition,
  source: AgentSource,
  options: ConvertOptions = {},
): SkillDefinition {
  const metadata: Record<string, string> = {
    'source-repo': source.repo,
    'source-path': source.path,
    'source-ref': source.ref,
    'original-name': agent.name,
    'converted-by': 'agent-skill-hub',
    ...(agent.model ? { model: agent.model } : {}),
    ...(agent.tools.length > 0 ? { 'preferred-tools': agent.tools.join(' ') } : {}),
  }
  return {
    name: toSkillName(agent.name, options.namePrefix),
    description: cleanDescription(agent.description),
    license: options.license,
    allowedTools: options.grantTools ? [...agent.tools] : [],
    metadata,
    body: buildBody(agent),
  }
}

/** 설명에서 `<example>` 등 태그 블록과 남은 XML 태그, "Examples:" 꼬리를 제거하고 스펙 길이로 자른다. */
export function cleanDescription(description: string): string {
  const unescaped = description.replace(/\\n/g, '\n')
  const withoutMarkup = unescaped
    .replace(/<(\w+)>[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\bExamples?:\s*$/i, '')
  const collapsed = withoutMarkup.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= MAX_DESCRIPTION_LENGTH) return collapsed
  return `${collapsed.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`
}

function buildBody(agent: AgentDefinition): string {
  const title = toTitle(agent.name)
  const toolLine =
    agent.tools.length > 0 ? `Preferred tools: ${agent.tools.join(', ')}.\n\n` : ''
  return [
    `# ${title}`,
    '',
    `This skill was converted from the "${agent.name}" AI agent. When this skill is active, adopt the role and instructions below as your operating persona for the task.`,
    '',
    `${toolLine}## Role and instructions`,
    '',
    agent.systemPrompt.trim(),
    '',
  ].join('\n')
}

function toTitle(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
