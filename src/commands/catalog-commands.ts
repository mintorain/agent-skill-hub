import type { Command } from 'commander'
import type { Hub } from '../service/hub.js'
import type { Logger } from '../util/logger.js'
import { parsePositiveInt } from './options.js'

const DESCRIPTION_PREVIEW_LENGTH = 110

export function registerCatalogCommands(program: Command, hub: Hub, logger: Logger): void {
  program
    .command('update')
    .description('등록된 GitHub 소스를 크롤링해 에이전트 카탈로그를 갱신합니다')
    .action(async () => {
      const reports = await hub.update((repo, completed, total) => {
        if (completed === total) logger.info(`  ${repo}: ${total}개 파일 처리 완료`)
      })
      for (const report of reports) {
        logger.info(
          report.error
            ? `[실패] ${report.repo}: ${report.error}`
            : `[완료] ${report.repo}@${report.ref.slice(0, 7)}: ${report.indexed}개 인덱싱, ${report.skipped}개 건너뜀`,
        )
      }
      if (reports.some((r) => r.error)) process.exitCode = 1
    })

  program
    .command('search [query]')
    .description('카탈로그에서 에이전트를 검색합니다')
    .option('-r, --repo <repo>', '특정 레포로 제한')
    .option('-c, --category <category>', '카테고리로 제한')
    .option('-n, --limit <n>', '최대 결과 수', '30')
    .option('--json', 'JSON으로 출력')
    .action(async (query: string | undefined, opts: { repo?: string; category?: string; limit: string; json?: boolean }) => {
      const limit = parsePositiveInt(opts.limit, '--limit')
      const results = await hub.search(query ?? '', { repo: opts.repo, category: opts.category, limit })
      if (opts.json) return logger.info(JSON.stringify(results, null, 2))
      if (results.length === 0) return logger.info('결과가 없습니다. `ash update` 를 먼저 실행했는지 확인하세요.')
      for (const entry of results) {
        logger.info(`${entry.skillName.padEnd(36)} ${entry.repo}${entry.category ? ` [${entry.category}]` : ''}`)
        logger.info(`    ${truncate(entry.description, DESCRIPTION_PREVIEW_LENGTH)}`)
      }
    })

  program
    .command('preview <entry>')
    .description('변환될 SKILL.md 를 설치하지 않고 출력합니다 (entry = 스킬 이름 또는 repo:path)')
    .option('-p, --prefix <prefix>', '스킬 이름 접두사')
    .action(async (entry: string, opts: { prefix?: string }) => {
      const { markdown } = await hub.preview(entry, opts.prefix)
      logger.info(markdown)
    })
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
