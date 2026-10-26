import type { Command } from 'commander'
import type { Hub } from '../service/hub.js'
import type { Logger } from '../util/logger.js'
import { registerCatalogCommands } from './catalog-commands.js'
import { registerInstallCommands } from './install-commands.js'
import { registerSourceCommands } from './source-commands.js'
import { registerServeCommand } from './serve-command.js'

export function registerCommands(program: Command, hub: Hub, logger: Logger): void {
  registerCatalogCommands(program, hub, logger)
  registerInstallCommands(program, hub, logger)
  registerSourceCommands(program, hub, logger)
  registerServeCommand(program, hub, logger)
}
