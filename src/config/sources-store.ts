import { z } from 'zod'
import { isValidRef } from '../github/client.js'
import { readJsonFile, writeJsonFile } from '../util/json-file.js'
import type { SourceRepo } from '../core/types.js'
import { DEFAULT_SOURCES } from './default-sources.js'

const MAX_GLOBS = 20
const MAX_GLOB_LENGTH = 200

/** CLI 와 서버가 함께 쓰는 소스 입력 검증 스키마. */
export const sourceSchema = z.object({
  repo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'owner/repo 형식이어야 합니다'),
  ref: z.string().default('').refine((ref) => ref === '' || isValidRef(ref), '올바르지 않은 ref 입니다'),
  agentGlobs: z.array(z.string().max(MAX_GLOB_LENGTH)).max(MAX_GLOBS).default([]),
})

const sourcesSchema = z.object({ sources: z.array(sourceSchema) })

/** 사용자 소스 파일이 없으면 기본 소스를 돌려준다. */
export async function readSources(file: string): Promise<readonly SourceRepo[]> {
  const raw = await readJsonFile(file)
  if (raw === undefined) return DEFAULT_SOURCES
  const result = sourcesSchema.safeParse(raw)
  if (!result.success) throw new Error(`소스 파일이 손상되었습니다 (${file})`)
  return result.data.sources
}

export async function writeSources(file: string, sources: readonly SourceRepo[]): Promise<void> {
  await writeJsonFile(file, { sources })
}

export function addSource(sources: readonly SourceRepo[], input: unknown): readonly SourceRepo[] {
  const result = sourceSchema.safeParse(input)
  if (!result.success) throw new Error(`소스 입력이 올바르지 않습니다: ${result.error.issues.map((i) => i.message).join('; ')}`)
  const source = result.data
  if (sources.some((s) => s.repo === source.repo)) {
    throw new Error(`소스 "${source.repo}" 이(가) 이미 등록되어 있습니다`)
  }
  return [...sources, source]
}

export function removeSource(sources: readonly SourceRepo[], repo: string): readonly SourceRepo[] {
  if (!sources.some((s) => s.repo === repo)) {
    throw new Error(`소스 "${repo}" 이(가) 등록되어 있지 않습니다`)
  }
  return sources.filter((s) => s.repo !== repo)
}
