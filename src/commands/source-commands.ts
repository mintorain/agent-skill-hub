import type { Command } from 'commander'
import type { Hub } from '../service/hub.js'
import type { Logger } from '../util/logger.js'

export function registerSourceCommands(program: Command, hub: Hub, logger: Logger): void {
  const sources = program.command('sources').description('에이전트 소스 레포를 관리합니다')

  sources
    .command('list', { isDefault: true })
    .description('등록된 소스 레포 목록')
    .action(async () => {
      for (const source of await hub.sources()) {
        logger.info(`${source.repo}${source.ref ? `@${source.ref}` : ''}  ${source.agentGlobs.join(' ') || '(기본 glob)'}`)
      }
    })

  sources
    .command('add <repo>')
    .description('소스 레포 추가 (owner/repo)')
    .option('-r, --ref <ref>', '브랜치/태그 (기본: 기본 브랜치)', '')
    .option('-g, --glob <patterns...>', '에이전트 파일 glob (기본: agents/**/*.md)')
    .action(async (repo: string, opts: { ref: string; glob?: string[] }) => {
      await hub.addSource({ repo, ref: opts.ref, agentGlobs: opts.glob ?? [] })
      logger.info(`[추가] ${repo}. 'ash update' 로 인덱싱하세요.`)
    })

  sources
    .command('remove <repo>')
    .description('소스 레포 제거')
    .action(async (repo: string) => {
      await hub.removeSource(repo)
      logger.info(`[제거] ${repo}`)
    })
}
