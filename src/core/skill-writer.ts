import { serializeFrontmatter } from './frontmatter.js'
import type { SkillDefinition } from './types.js'

/** SkillDefinition을 SKILL.md 문자열로 렌더링한다. */
export function renderSkillMarkdown(skill: SkillDefinition): string {
  const frontmatter = {
    name: skill.name,
    description: skill.description,
    license: skill.license,
    compatibility: skill.compatibility,
    'allowed-tools': skill.allowedTools.length > 0 ? skill.allowedTools.join(' ') : undefined,
    metadata: Object.keys(skill.metadata).length > 0 ? { ...skill.metadata } : undefined,
  }
  return serializeFrontmatter(frontmatter, skill.body)
}
