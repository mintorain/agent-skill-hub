#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { resolvePaths } from './config/paths.js'
import { createGitHubClient } from './github/client.js'
import { createHub } from './service/hub.js'
import { createLogger } from './util/logger.js'
import { registerCommands } from './commands/register.js'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

const program = new Command()
program
  .name('ash')
  .description('GitHub의 AI 에이전트 정의를 Claude Skill로 변환·설치하는 Agent Skill Hub')
  .version(version)

const hub = createHub(createGitHubClient(), resolvePaths())
registerCommands(program, hub, createLogger())

program.parseAsync(process.argv).catch((error: unknown) => {
  process.stderr.write(`오류: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
