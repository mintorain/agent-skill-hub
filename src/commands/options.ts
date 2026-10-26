import { z } from 'zod'
import type { InstallScope } from '../core/types.js'

const positiveInt = z.coerce.number().int().positive()
const port = z.coerce.number().int().min(0).max(65535)

export function parsePositiveInt(value: string, label: string): number {
  const result = positiveInt.safeParse(value)
  if (!result.success) throw new Error(`${label} 은(는) 양의 정수여야 합니다: "${value}"`)
  return result.data
}

export function parsePort(value: string): number {
  const result = port.safeParse(value)
  if (!result.success) throw new Error(`포트는 0~65535 사이 정수여야 합니다: "${value}"`)
  return result.data
}

export function scopeOf(opts: { project?: boolean }): InstallScope {
  return opts.project ? 'project' : 'global'
}
