import type { Command } from 'commander'
import { createApp } from '../server/app.js'
import type { Hub } from '../service/hub.js'
import type { Logger } from '../util/logger.js'
import { parsePort } from './options.js'

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1'])

export function registerServeCommand(program: Command, hub: Hub, logger: Logger): void {
  program
    .command('serve')
    .description('로컬 웹 대시보드를 띄웁니다')
    .option('-p, --port <port>', '포트', '4747')
    .option('--host <host>', '바인딩 주소 (루프백만 허용)', '127.0.0.1')
    .action((opts: { port: string; host: string }) => {
      if (!LOOPBACK.has(opts.host)) {
        throw new Error(`대시보드는 인증이 없으므로 루프백 주소에만 바인딩할 수 있습니다: ${opts.host}`)
      }
      const port = parsePort(opts.port)
      const server = createApp(hub)
      server.listen(port, opts.host, () => {
        logger.info(`Agent Skill Hub 대시보드: http://${opts.host}:${port}`)
      })
      server.on('error', (error) => logger.error(error.message))
    })
}
