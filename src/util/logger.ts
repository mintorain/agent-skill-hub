/** 콘솔 출력을 한 곳에서 다룬다 (stdout/stderr 분리). */
export interface Logger {
  readonly info: (message: string) => void
  readonly warn: (message: string) => void
  readonly error: (message: string) => void
}

export function createLogger(out: NodeJS.WritableStream = process.stdout, err: NodeJS.WritableStream = process.stderr): Logger {
  return {
    info: (message) => out.write(`${message}\n`),
    warn: (message) => err.write(`경고: ${message}\n`),
    error: (message) => err.write(`오류: ${message}\n`),
  }
}

export const silentLogger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined }
