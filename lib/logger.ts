import debug from "debug"

// A `debug` instance is callable and gated behind the DEBUG env var, but it has
// no `.error` / `.warn` / `.info` methods — calling them (as several routes do)
// throws "log.error is not a function" at runtime. It only type-checked because
// `debug` ships no types, so `logger.extend(...)` is `any`. `withLevels` adds
// leveled methods on top of the callable so both styles work:
//   log("scope", "msg", data)   → gated debug channel (unchanged)
//   log.error("msg", err)       → always surfaces via console.error
export interface Logger {
  (formatter: any, ...args: any[]): void
  error: (...args: any[]) => void
  warn: (...args: any[]) => void
  info: (...args: any[]) => void
  debug: (...args: any[]) => void
  extend: (namespace: string, delimiter?: string) => Logger
  namespace: string
  enabled: boolean
}

function withLevels(base: any): Logger {
  const tag = () => `[${base.namespace}]`
  // Errors and warnings always surface (Vercel/serverless capture console.*).
  base.error = (...args: any[]) => console.error(tag(), ...args)
  base.warn = (...args: any[]) => console.warn(tag(), ...args)
  base.info = (...args: any[]) => console.info(tag(), ...args)
  // debug-level stays gated behind the DEBUG env var, like the callable form.
  base.debug = (...args: any[]) => base(...args)
  // Keep leveled methods when a caller derives a child logger via .extend().
  const rawExtend = base.extend.bind(base)
  base.extend = (namespace: string, delimiter?: string) => withLevels(rawExtend(namespace, delimiter))
  return base as Logger
}

export const logger = withLevels(debug("dispotool"))

export const createLogger = (namespace: string): Logger => logger.extend(namespace)
