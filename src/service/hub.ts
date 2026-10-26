import { parseAgentMarkdown } from '../core/agent-parser.js'
import { convertAgentToSkill } from '../core/skill-converter.js'
import { renderSkillMarkdown } from '../core/skill-writer.js'
import type { Catalog, CatalogEntry, InstalledSkill, InstallScope, SkillDefinition, SourceRepo } from '../core/types.js'
import { indexSource, type IndexResult, type ProgressListener } from '../catalog/indexer.js'
import { mergeCatalog, readCatalog, writeCatalog } from '../catalog/index-store.js'
import { searchCatalog, type SearchOptions } from '../catalog/search.js'
import type { GitHubClient } from '../github/client.js'
import { installSkill, uninstallSkill } from '../install/installer.js'
import { readRegistry } from '../install/registry.js'
import { addSource, readSources, removeSource, writeSources } from '../config/sources-store.js'
import type { HubPaths } from '../config/paths.js'
import { withFileLock } from '../util/json-file.js'

export interface UpdateReport {
  readonly repo: string
  readonly ref: string
  readonly indexed: number
  readonly skipped: number
  readonly error?: string
}

export interface InstallRequest {
  readonly entryId: string
  readonly scope: InstallScope
  readonly force?: boolean
  readonly namePrefix?: string
  readonly grantTools?: boolean
}

export class UpdateInProgressError extends Error {
  constructor() {
    super('카탈로그 갱신이 이미 진행 중입니다')
  }
}

export interface Hub {
  readonly update: (onProgress?: ProgressListener) => Promise<readonly UpdateReport[]>
  readonly catalog: () => Promise<Catalog>
  readonly search: (query: string, options?: SearchOptions) => Promise<readonly CatalogEntry[]>
  readonly preview: (entryId: string, namePrefix?: string) => Promise<{ skill: SkillDefinition; markdown: string }>
  readonly install: (request: InstallRequest) => Promise<{ path: string; skill: SkillDefinition }>
  readonly uninstall: (skillName: string, scope: InstallScope) => Promise<void>
  readonly installed: () => Promise<readonly InstalledSkill[]>
  readonly sources: () => Promise<readonly SourceRepo[]>
  readonly addSource: (source: unknown) => Promise<readonly SourceRepo[]>
  readonly removeSource: (repo: string) => Promise<readonly SourceRepo[]>
}

/** CLI와 웹 서버가 공유하는 애플리케이션 서비스. */
export function createHub(client: GitHubClient, paths: HubPaths): Hub {
  const state = { updating: false }
  const skillsDirFor = (scope: InstallScope) => (scope === 'global' ? paths.globalSkillsDir : paths.projectSkillsDir)

  async function findEntry(entryId: string): Promise<CatalogEntry> {
    const catalog = await readCatalog(paths.catalogFile)
    const byId = catalog.entries.find((e) => e.id === entryId)
    if (byId) return byId
    const byName = catalog.entries.filter((e) => e.skillName === entryId)
    if (byName.length === 1) return byName[0] as CatalogEntry
    if (byName.length > 1) {
      const ids = byName.map((e) => `  - ${e.id}`).join('\n')
      throw new Error(`"${entryId}" 이름의 에이전트가 여러 레포에 있습니다. repo:path 형식으로 지정하세요:\n${ids}`)
    }
    throw new Error(`카탈로그에서 "${entryId}" 을(를) 찾을 수 없습니다. 'ash update' 를 먼저 실행하세요.`)
  }

  async function buildSkill(entry: CatalogEntry, namePrefix?: string, grantTools?: boolean): Promise<SkillDefinition> {
    const text = await client.fetchRaw(entry.repo, entry.ref, entry.path)
    const agent = parseAgentMarkdown(text)
    return convertAgentToSkill(agent, { repo: entry.repo, path: entry.path, ref: entry.ref }, { namePrefix, grantTools })
  }

  async function indexAll(sources: readonly SourceRepo[], onProgress?: ProgressListener): Promise<readonly UpdateReport[]> {
    const outcomes = await sequential<SourceRepo, Outcome>(sources, async (source) => {
      try {
        return { result: await indexSource(client, source, onProgress) }
      } catch (error) {
        return { source, error: toMessage(error) }
      }
    })
    await withFileLock(paths.catalogFile, async () => {
      const current = await readCatalog(paths.catalogFile)
      const activeRepos = new Set(sources.map((s) => s.repo))
      const pruned = { ...current, entries: current.entries.filter((e) => activeRepos.has(e.repo)) }
      const merged = outcomes.reduce<Catalog>(
        (catalog, outcome) => ('result' in outcome ? mergeCatalog(catalog, outcome.result.repo, outcome.result.entries) : catalog),
        pruned,
      )
      await writeCatalog(paths.catalogFile, merged)
    })
    return outcomes.map((outcome) => ('result' in outcome ? toReport(outcome.result) : { repo: outcome.source.repo, ref: outcome.source.ref, indexed: 0, skipped: 0, error: outcome.error }))
  }

  return {
    async update(onProgress) {
      if (state.updating) throw new UpdateInProgressError()
      state.updating = true
      try {
        return await indexAll(await readSources(paths.sourcesFile), onProgress)
      } finally {
        state.updating = false
      }
    },
    catalog: () => readCatalog(paths.catalogFile),
    async search(query, options) {
      const catalog = await readCatalog(paths.catalogFile)
      return searchCatalog(catalog.entries, query, options)
    },
    async preview(entryId, namePrefix) {
      const skill = await buildSkill(await findEntry(entryId), namePrefix)
      return { skill, markdown: renderSkillMarkdown(skill) }
    },
    async install(request) {
      const entry = await findEntry(request.entryId)
      const skill = await buildSkill(entry, request.namePrefix, request.grantTools)
      const { path } = await installSkill(skill, {
        skillsDir: skillsDirFor(request.scope),
        registryFile: paths.registryFile,
        scope: request.scope,
        entryId: entry.id,
        force: request.force,
      })
      return { path, skill }
    },
    uninstall: (skillName, scope) =>
      uninstallSkill(skillName, { skillsDir: skillsDirFor(scope), registryFile: paths.registryFile, scope }),
    installed: async () => (await readRegistry(paths.registryFile)).skills,
    sources: () => readSources(paths.sourcesFile),
    addSource: (source) =>
      withFileLock(paths.sourcesFile, async () => {
        const next = addSource(await readSources(paths.sourcesFile), source)
        await writeSources(paths.sourcesFile, next)
        return next
      }),
    removeSource: (repo) =>
      withFileLock(paths.sourcesFile, async () => {
        const next = removeSource(await readSources(paths.sourcesFile), repo)
        await writeSources(paths.sourcesFile, next)
        return next
      }),
  }
}

type Outcome = { readonly result: IndexResult } | { readonly source: SourceRepo; readonly error: string }

const toReport = (result: IndexResult): UpdateReport => ({
  repo: result.repo,
  ref: result.ref,
  indexed: result.entries.length,
  skipped: result.skipped.length,
})

async function sequential<T, R>(items: readonly T[], task: (item: T) => Promise<R>): Promise<readonly R[]> {
  return items.reduce<Promise<readonly R[]>>(
    async (accumulated, item) => [...(await accumulated), await task(item)],
    Promise.resolve([]),
  )
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
