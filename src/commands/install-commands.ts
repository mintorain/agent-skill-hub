import type { Command } from 'commander'
import type { Hub } from '../service/hub.js'
import type { Logger } from '../util/logger.js'
import { scopeOf } from './options.js'

interface InstallOpts {
  readonly project?: boolean
  readonly force?: boolean
  readonly prefix?: string
  readonly grantTools?: boolean
}

export function registerInstallCommands(program: Command, hub: Hub, logger: Logger): void {
  program
    .command('install <entries...>')
    .description('에이전트를 Claude Skill로 변환해 설치합니다 (전역: ~/.claude/skills, --project: ./.claude/skills)')
    .option('-P, --project', '현재 프로젝트의 .claude/skills 에 설치')
    .option('-f, --force', '이미 설치된 스킬 덮어쓰기')
    .option('-p, --prefix <prefix>', '스킬 이름 접두사 (예: gh)')
    .option('--grant-tools', '에이전트의 tools 를 allowed-tools 로 내보내 권한 확인 없이 쓰게 함 (신뢰할 수 있는 소스에만)')
    .action(async (entries: string[], opts: InstallOpts) => {
      if (opts.grantTools) logger.warn('--grant-tools: 스킬이 활성화된 동안 나열된 도구는 권한 확인 없이 실행됩니다.')
      await forEachReporting(entries, logger, async (entryId) => {
        const { path, skill } = await hub.install({ entryId, scope: scopeOf(opts), force: opts.force, namePrefix: opts.prefix, grantTools: opts.grantTools })
        logger.info(`[설치] ${skill.name} -> ${path}`)
      })
    })

  program
    .command('remove <skillNames...>')
    .alias('uninstall')
    .description('설치한 스킬을 제거합니다')
    .option('-P, --project', '프로젝트 범위에서 제거')
    .action(async (skillNames: string[], opts: { project?: boolean }) => {
      await forEachReporting(skillNames, logger, async (name) => {
        await hub.uninstall(name, scopeOf(opts))
        logger.info(`[제거] ${name}`)
      })
    })

  program
    .command('list')
    .description('설치된 스킬 목록을 보여줍니다')
    .action(async () => {
      const skills = await hub.installed()
      if (skills.length === 0) return logger.info('설치된 스킬이 없습니다.')
      for (const skill of skills) logger.info(`${skill.skillName.padEnd(36)} ${skill.scope.padEnd(8)} ${skill.path}`)
    })
}

/** 항목별로 실패를 보고하되 나머지는 계속 처리한다. 하나라도 실패하면 exit code 1. */
async function forEachReporting(items: readonly string[], logger: Logger, task: (item: string) => Promise<void>): Promise<void> {
  for (const item of items) {
    try {
      await task(item)
    } catch (error) {
      logger.error(`${item}: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    }
  }
}
