import { z } from 'zod'
import { readJsonFile, writeJsonFile } from '../util/json-file.js'
import type { InstalledSkill, InstallScope } from '../core/types.js'

export interface Registry {
  readonly skills: readonly InstalledSkill[]
}

const registrySchema = z.object({
  skills: z.array(
    z.object({
      skillName: z.string(),
      entryId: z.string(),
      scope: z.enum(['global', 'project']),
      skillsDir: z.string(),
      path: z.string(),
      installedAt: z.string(),
    }),
  ),
})

export async function readRegistry(file: string): Promise<Registry> {
  const raw = await readJsonFile(file)
  if (raw === undefined) return { skills: [] }
  const result = registrySchema.safeParse(raw)
  if (!result.success) throw new Error(`설치 기록 파일이 손상되었습니다 (${file})`)
  return result.data
}

export async function writeRegistry(file: string, registry: Registry): Promise<void> {
  await writeJsonFile(file, registry)
}

const sameSlot = (a: InstalledSkill, name: string, scope: InstallScope, skillsDir: string) =>
  a.skillName === name && a.scope === scope && a.skillsDir === skillsDir

export function findRecord(registry: Registry, name: string, scope: InstallScope, skillsDir: string): InstalledSkill | undefined {
  return registry.skills.find((s) => sameSlot(s, name, scope, skillsDir))
}

export function upsertRecord(registry: Registry, record: InstalledSkill): Registry {
  const others = registry.skills.filter((s) => !sameSlot(s, record.skillName, record.scope, record.skillsDir))
  return { skills: [...others, record] }
}

export function removeRecord(registry: Registry, name: string, scope: InstallScope, skillsDir: string): Registry {
  return { skills: registry.skills.filter((s) => !sameSlot(s, name, scope, skillsDir)) }
}
