// Mock ffmpeg so CI doesn't need the binary
vi.mock('@ffmpeg/ffmpeg', () => ({
  createFFmpeg: () => ({ load: async () => {}, FS: () => {}, run: async () => {} }),
}))

// MSW to stub Telnyx HTTP
import { rest } from 'msw'
import { setupServer } from 'msw/node'
const server = setupServer(
  rest.post('https://api.telnyx.com/v2/telephony_credentials/:id/token', (_req, res, ctx) =>
    res(ctx.json({ data: { token: 'test-token', expires_at: new Date().toISOString() } })),
  ),
  rest.post('https://api.telnyx.com/v2/telephony_credentials', (_req, res, ctx) => {
    const connectionId =
      process.env.TELNYX_SIP_CONNECTION_ID ||
      process.env.SIP_CONNECTION_ID ||
      process.env.SIP_CREDENTIAL_CONNECTION_ID ||
      process.env.VOICE_CONNECTION_ID ||
      process.env.TELNYX_VOICE_CONNECTION_ID ||
      process.env.CALL_CONTROL_APP_ID ||
      'voice-conn-1'
    return res(ctx.json({ data: { id: 'cred_123', username: 'sip_123', connection_id: connectionId } }))
  }),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
