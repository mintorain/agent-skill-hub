import { z } from 'zod'
import { parseFrontmatter } from './frontmatter.js'
import type { AgentDefinition } from './types.js'

const toolsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => normalizeTools(value))

const agentFrontmatterSchema = z.object({
  name: z.string().min(1, 'name 필드가 필요합니다'),
  description: z.string().min(1, 'description 필드가 필요합니다'),
  tools: toolsSchema,
  model: z.string().optional(),
})

function normalizeTools(value: string | readonly string[] | undefined): readonly string[] {
  if (value === undefined) return []
  const list = typeof value === 'string' ? value.split(/[,\s]+/) : value
  return list.map((tool) => tool.trim()).filter((tool) => tool.length > 0)
}

/** 서브에이전트 마크다운(프론트매터 + 시스템 프롬프트)을 AgentDefinition으로 파싱한다. */
export function parseAgentMarkdown(text: string): AgentDefinition {
  const { data, body } = parseFrontmatter(text)
  const result = agentFrontmatterSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`에이전트 프론트매터가 올바르지 않습니다 (${issues.join('; ')})`)
  }
  const systemPrompt = body.trim()
  if (systemPrompt.length === 0) {
    throw new Error('에이전트 본문(body)이 비어 있습니다')
  }
  const { name, description, tools, model } = result.data
  return model === undefined
    ? { name, description, tools, systemPrompt }
    : { name, description, tools, model, systemPrompt }
}

/** 파일이 에이전트 정의처럼 보이는지 빠르게 판별한다. 예외를 던지지 않는다. */
export function isAgentDocument(text: string): boolean {
  try {
    parseAgentMarkdown(text)
    return true
  } catch {
    return false
  }
}
