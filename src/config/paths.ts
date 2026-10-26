import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export interface HubPaths {
  readonly dataDir: string
  readonly catalogFile: string
  readonly sourcesFile: string
  readonly registryFile: string
  readonly globalSkillsDir: string
  readonly projectSkillsDir: string
}

/** 환경 변수로 덮어쓸 수 있는 기본 경로 집합. */
export function resolvePaths(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): HubPaths {
  const home = env['HOME'] ?? homedir()
  const dataDir = env['ASH_DATA_DIR'] ?? join(home, '.agent-skill-hub')
  const claudeDir = env['CLAUDE_CONFIG_DIR'] ?? join(home, '.claude')
  return {
    dataDir,
    catalogFile: join(dataDir, 'catalog.json'),
    sourcesFile: join(dataDir, 'sources.json'),
    registryFile: join(dataDir, 'installed.json'),
    globalSkillsDir: env['ASH_GLOBAL_SKILLS_DIR'] ?? join(claudeDir, 'skills'),
    projectSkillsDir: resolve(cwd, '.claude', 'skills'),
  }
}
