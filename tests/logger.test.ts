import { afterEach, describe, expect, test, vi } from "vitest"
import { createLogger, logger } from "@/lib/logger"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createLogger", () => {
  test("returns a callable that also exposes leveled methods", () => {
    const log = createLogger("test:callable")
    expect(typeof log).toBe("function")
    expect(typeof log.error).toBe("function")
    expect(typeof log.warn).toBe("function")
    expect(typeof log.info).toBe("function")
    expect(typeof log.debug).toBe("function")
  })

  test("log.error / warn / info surface via console (the runtime regression)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})

    const log = createLogger("test:levels")
    const err = new Error("boom")

    expect(() => log.error("GET failed", err)).not.toThrow()
    expect(() => log.warn("heads up")).not.toThrow()
    expect(() => log.info("fyi")).not.toThrow()

    expect(errorSpy).toHaveBeenCalledWith("[dispotool:test:levels]", "GET failed", err)
    expect(warnSpy).toHaveBeenCalledWith("[dispotool:test:levels]", "heads up")
    expect(infoSpy).toHaveBeenCalledWith("[dispotool:test:levels]", "fyi")
  })

  test("the callable form still works and does not throw", () => {
    const log = createLogger("test:call")
    expect(() => log("queue", "message", { n: 1 })).not.toThrow()
  })

  test("child loggers derived via .extend keep the leveled methods", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const child = createLogger("test:parent").extend("child")
    expect(typeof child.error).toBe("function")
    expect(() => child.error("nested")).not.toThrow()
    expect(errorSpy).toHaveBeenCalledWith("[dispotool:test:parent:child]", "nested")
  })

  test("the root logger export also has leveled methods", () => {
    expect(typeof logger.error).toBe("function")
    expect(typeof logger.extend).toBe("function")
  })
})
