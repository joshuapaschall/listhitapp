/** @jest-environment jsdom */
import { beforeAll, describe, expect, test, jest } from "@jest/globals"
import { render, fireEvent } from "@testing-library/react"
import ThemeToggle from "../components/theme-toggle"
import { ThemeProvider } from "../components/theme-provider"

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  })
})

describe("ThemeToggle", () => {
  test("toggles dark mode", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    )
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    const button = document.querySelector("button") as HTMLButtonElement
    fireEvent.click(button)
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })
})
