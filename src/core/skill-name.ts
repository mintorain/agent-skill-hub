const MAX_NAME_LENGTH = 64
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 임의 문자열을 agentskills.io 스펙(소문자·숫자·하이픈, 최대 64자)에 맞는 스킬 이름으로 바꾼다. */
export function toSkillName(raw: string, prefix?: string): string {
  const withPrefix = prefix ? `${prefix}-${raw}` : raw
  const slug = withPrefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const truncated = slug.slice(0, MAX_NAME_LENGTH).replace(/-$/, '')
  if (!isValidSkillName(truncated)) {
    throw new Error(`스킬 이름으로 변환할 수 없습니다: "${raw}"`)
  }
  return truncated
}

export function isValidSkillName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && NAME_PATTERN.test(name)
}
