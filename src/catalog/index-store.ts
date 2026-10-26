import { z } from 'zod'
import { readJsonFile, writeJsonFile } from '../util/json-file.js'
import type { Catalog, CatalogEntry } from '../core/types.js'

const entrySchema = z.object({
  id: z.string(),
  skillName: z.string(),
  originalName: z.string(),
  description: z.string(),
  tools: z.array(z.string()),
  model: z.string().optional(),
  repo: z.string(),
  path: z.string(),
  ref: z.string(),
  category: z.string().optional(),
})

const catalogSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  entries: z.array(entrySchema),
})

export const emptyCatalog = (): Catalog => ({ version: 1, updatedAt: new Date(0).toISOString(), entries: [] })

export async function readCatalog(file: string): Promise<Catalog> {
  const raw = await readJsonFile(file)
  if (raw === undefined) return emptyCatalog()
  const result = catalogSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`카탈로그 파일이 손상되었습니다 (${file}). 'ash update'로 다시 생성하세요.`)
  }
  return result.data
}

export async function writeCatalog(file: string, catalog: Catalog): Promise<void> {
  await writeJsonFile(file, catalog)
}

/** 특정 레포의 항목을 새 항목으로 교체한 새 카탈로그를 돌려준다. */
export function mergeCatalog(existing: Catalog, repo: string, entries: readonly CatalogEntry[]): Catalog {
  const others = existing.entries.filter((entry) => entry.repo !== repo)
  return { version: 1, updatedAt: new Date().toISOString(), entries: [...others, ...entries] }
}
