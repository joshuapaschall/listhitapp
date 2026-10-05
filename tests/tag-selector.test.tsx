/** @jest-environment jsdom */
// The whole point of routing tag creation through the server: typing an
// existing tag in a different case must SELECT that tag, not mint a duplicate.

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import TagSelector from "../components/buyers/tag-selector"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const fetchMock = vi.fn()

beforeAll(() => {
  if (!(global as any).PointerEvent) {
    ;(global as any).PointerEvent = class extends MouseEvent {} as any
  }
  Element.prototype.hasPointerCapture = vi.fn(() => false) as any
  Element.prototype.scrollIntoView = vi.fn() as any
})

function renderSelector(onChange: (tags: string[]) => void, value: string[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TagSelector value={value} onChange={onChange} />
    </QueryClientProvider>,
  )
}

describe("TagSelector", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // @ts-ignore
    global.fetch = fetchMock
  })

  test("typing 'atlanta closers' offers the existing 'Atlanta Closers' — no Create row", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        tags: [{ id: "t1", name: "Atlanta Closers", color: "#3B82F6", is_protected: false }],
      }),
    }))

    const onChange = vi.fn()
    renderSelector(onChange)

    const input = screen.getByPlaceholderText(/search or create tags/i)
    fireEvent.focus(input)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/tags"))

    fireEvent.change(input, { target: { value: "atlanta closers" } })

    // The existing tag is offered in its own casing...
    const option = await screen.findByText("Atlanta Closers")
    // ...and no duplicate-creating Create row is shown.
    expect(screen.queryByText(/^Create /i)).toBeNull()

    fireEvent.click(option)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["Atlanta Closers"]))
  })

  test("creating 'atlanta closers' against a stale cache still selects the canonical tag", async () => {
    // The local vocabulary hasn't caught up (another user just created the tag),
    // so the Create row IS reachable. The server matches case-insensitively and
    // returns the canonical row, which is what must land in `value`.
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/tags" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            tag: { id: "t1", name: "Atlanta Closers", color: "#3B82F6", is_protected: false },
          }),
        }
      }
      return { ok: true, json: async () => ({ tags: [] }) }
    })

    const onChange = vi.fn()
    renderSelector(onChange)

    const input = screen.getByPlaceholderText(/search or create tags/i)
    fireEvent.focus(input)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/tags"))

    fireEvent.change(input, { target: { value: "atlanta closers" } })
    fireEvent.click(await screen.findByText(/Create "atlanta closers"/i))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    // The canonical casing, not what was typed.
    expect(onChange).toHaveBeenCalledWith(["Atlanta Closers"])

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    )
    expect(postCall).toBeTruthy()
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
      name: "atlanta closers",
    })
  })

  test("a tag already selected is not added twice", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/tags" && init?.method === "POST") {
        return { ok: true, json: async () => ({ tag: { id: "t1", name: "Investor" } }) }
      }
      // Stale cache, so the Create row is reachable even though the tag exists.
      return { ok: true, json: async () => ({ tags: [] }) }
    })

    const onChange = vi.fn()
    renderSelector(onChange, ["Investor"])

    const input = screen.getByPlaceholderText("")
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "investor" } })

    const createRow = await screen.findByText(/Create "investor"/i)
    fireEvent.click(createRow)

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      )
      expect(postCall).toBeTruthy()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  test("a failed create surfaces the server's message and selects nothing", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/tags" && init?.method === "POST") {
        return { ok: false, json: async () => ({ error: "Enter a tag name between 1 and 60 characters." }) }
      }
      return { ok: true, json: async () => ({ tags: [] }) }
    })

    const { toast } = await import("sonner")
    const onChange = vi.fn()
    renderSelector(onChange)

    const input = screen.getByPlaceholderText(/search or create tags/i)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "x".repeat(61) } })

    fireEvent.click(await screen.findByText(/^Create /i))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Enter a tag name between 1 and 60 characters."),
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})
