/** @jest-environment jsdom */
import React from "react"
import { render, screen } from "@testing-library/react"
import { Sidebar } from "../components/layout/sidebar"

(globalThis as typeof globalThis & { React: typeof React }).React = React

const invalidateQueries = vi.fn()

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: 0 })),
  useQueryClient: () => ({ invalidateQueries }),
}))

vi.mock("../lib/supabase", () => {
  const channel = { on: () => channel, subscribe: () => ({}) }
  const client = { channel: () => channel, removeChannel: vi.fn() }
  return { supabase: client, supabaseAdmin: client }
})

describe("Sidebar navigation", () => {
  test("does not render removed reports or admin links", () => {
    render(<Sidebar />)

    expect(screen.queryByText("Reports")).toBeNull()
    expect(screen.queryByText("Admin")).toBeNull()
    expect(screen.queryByText("Health")).toBeNull()
  })
})
