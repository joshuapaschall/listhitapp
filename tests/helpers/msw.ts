import { afterAll, afterEach, beforeAll } from "vitest"
import { mswServer } from "../setup"

/** Opt a test file into the shared MSW server (Telnyx HTTP handlers). */
export function useMswServer() {
  beforeAll(() => mswServer.listen({ onUnhandledRequest: "bypass" }))
  afterEach(() => mswServer.resetHandlers())
  afterAll(() => mswServer.close())
}
