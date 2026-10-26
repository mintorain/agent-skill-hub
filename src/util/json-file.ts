import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** JSON 파일을 읽는다. 파일이 없으면 undefined, 손상되었으면 에러. */
export async function readJsonFile(file: string): Promise<unknown> {
  try {
    const text = await readFile(file, 'utf8')
    return JSON.parse(text) as unknown
  } catch (error) {
    if (isNotFound(error)) return undefined
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`JSON 파일을 읽을 수 없습니다 (${file}): ${message}`)
  }
}

/** 임시 파일에 쓴 뒤 rename 하여 원자적으로 교체한다. */
export async function writeJsonFile(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tmp, file)
}

const locks = new Map<string, Promise<unknown>>()

/** 같은 키(파일)에 대한 읽기-수정-쓰기를 프로세스 안에서 직렬화한다. */
export async function withFileLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve()
  const run = previous.then(task, task)
  locks.set(key, run.catch(() => undefined))
  try {
    return await run
  } finally {
    if (locks.get(key) === run) locks.delete(key)
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT'
}
