'use client'

export default function GlobalError({
  error,
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body className="p-8">
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm opacity-70 mb-4">
          Check environment variables in Vercel settings if this keeps happening.
        </p>
        <pre className="p-3 rounded bg-neutral-100 text-xs overflow-auto mb-4">
          {error.message}
        </pre>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  )
}
