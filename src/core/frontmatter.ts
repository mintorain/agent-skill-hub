import YAML from 'yaml'

export interface FrontmatterDocument {
  readonly data: Readonly<Record<string, unknown>>
  readonly body: string
}

const DELIMITER = '---'

/** `---` 로 감싼 YAML 프론트매터와 본문을 분리한다. 프론트매터가 없으면 빈 data를 돌려준다. */
export function parseFrontmatter(text: string): FrontmatterDocument {
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines[0]?.trim() !== DELIMITER) {
    return { data: {}, body: normalized }
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === DELIMITER)
  if (closingIndex === -1) {
    return { data: {}, body: normalized }
  }
  const yamlText = lines.slice(1, closingIndex).join('\n')
  const body = lines.slice(closingIndex + 1).join('\n').replace(/^\n+/, '')
  return { data: parseYamlObject(yamlText), body }
}

function parseYamlObject(yamlText: string): Record<string, unknown> {
  try {
    const parsed: unknown = YAML.parse(yamlText)
    if (parsed === null || parsed === undefined) return {}
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('프론트매터는 키-값 매핑이어야 합니다')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    return parseLenient(yamlText, error)
  }
}

/**
 * 실제 에이전트 레포에는 `description: Use when... Examples: <example>...` 처럼
 * 엄격한 YAML로는 깨지는 값이 흔하다. Claude Code 처럼 `key: 나머지 전부` 로 관대하게 읽는다.
 */
function parseLenient(yamlText: string, cause: unknown): Record<string, unknown> {
  const entries = yamlText
    .split('\n')
    .map((line) => /^([A-Za-z0-9_-]+):\s?(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => [match[1] as string, (match[2] as string).trim()] as const)
  if (entries.length === 0) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`프론트매터(YAML) 파싱 실패: ${message}`)
  }
  return Object.fromEntries(entries)
}

/** 데이터와 본문을 프론트매터 문서로 직렬화한다. undefined 값은 생략한다. */
export function serializeFrontmatter(data: Readonly<Record<string, unknown>>, body: string): string {
  const defined = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
  const yamlText = YAML.stringify(defined, { lineWidth: 0 }).trimEnd()
  return `${DELIMITER}\n${yamlText}\n${DELIMITER}\n\n${body}`
}
