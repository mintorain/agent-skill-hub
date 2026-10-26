import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { isValidSkillName } from '../core/skill-name.js'
import { renderSkillMarkdown } from '../core/skill-writer.js'
import type { InstalledSkill, InstallScope, SkillDefinition } from '../core/types.js'
import { withFileLock } from '../util/json-file.js'
import { findRecord, readRegistry, removeRecord, upsertRecord, writeRegistry } from './registry.js'

export interface InstallOptions {
  readonly skillsDir: string
  readonly registryFile: string
  readonly scope: InstallScope
  readonly entryId: string
  readonly force?: boolean
}

export interface InstallResult {
  readonly path: string
  readonly record: InstalledSkill
}

/** 스킬을 `<skillsDir>/<name>/SKILL.md` 로 쓰고 설치 기록을 남긴다. */
export async function installSkill(skill: SkillDefinition, options: InstallOptions): Promise<InstallResult> {
  assertName(skill.name)
  const skillsDir = resolve(options.skillsDir)
  const dir = join(skillsDir, skill.name)
  const path = join(dir, 'SKILL.md')
  assertInside(skillsDir, dir)

  await mkdir(dir, { recursive: true })
  try {
    await writeFile(path, renderSkillMarkdown(skill), { encoding: 'utf8', flag: options.force ? 'w' : 'wx' })
  } catch (error) {
    if ((error as { code?: string }).code === 'EEXIST') {
      throw new Error(`스킬 "${skill.name}" 이(가) 이미 설치되어 있습니다 (${path}). --force 로 덮어쓸 수 있습니다.`)
    }
    throw error
  }

  const record: InstalledSkill = {
    skillName: skill.name,
    entryId: options.entryId,
    scope: options.scope,
    skillsDir,
    path,
    installedAt: new Date().toISOString(),
  }
  await withFileLock(options.registryFile, async () => {
    const registry = await readRegistry(options.registryFile)
    await writeRegistry(options.registryFile, upsertRecord(registry, record))
  })
  return { path, record }
}

export async function uninstallSkill(
  skillName: string,
  options: Pick<InstallOptions, 'skillsDir' | 'registryFile' | 'scope'>,
): Promise<void> {
  assertName(skillName)
  const skillsDir = resolve(options.skillsDir)
  await withFileLock(options.registryFile, async () => {
    const registry = await readRegistry(options.registryFile)
    const record = findRecord(registry, skillName, options.scope, skillsDir)
    if (!record) {
      throw new Error(`스킬 "${skillName}" 은(는) ${options.scope} 범위(${skillsDir})에 설치되어 있지 않습니다.`)
    }
    const dir = dirname(record.path)
    assertInside(skillsDir, dir)
    await rm(dir, { recursive: true, force: true })
    await writeRegistry(options.registryFile, removeRecord(registry, skillName, options.scope, skillsDir))
  })
}

function assertName(name: string): void {
  if (!isValidSkillName(name)) throw new Error(`올바르지 않은 스킬 이름입니다: "${name}"`)
}

function assertInside(root: string, target: string): void {
  if (!resolve(target).startsWith(root + sep)) {
    throw new Error(`설치 경로가 스킬 디렉터리 밖을 가리킵니다: ${target}`)
  }
}
