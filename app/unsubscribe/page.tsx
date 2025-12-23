import Link from "next/link"

export const dynamic = "force-dynamic"

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const email = typeof searchParams?.e === "string" ? searchParams.e : ""
  const buyerId = typeof searchParams?.id === "string" ? searchParams.id : ""
  const timestamp = typeof searchParams?.t === "string" ? searchParams.t : ""
  const signature = typeof searchParams?.s === "string" ? searchParams.s : ""
  const done = searchParams?.done === "1"
  const error = typeof searchParams?.error === "string" ? searchParams.error : ""
  const hasToken = buyerId && email && timestamp && signature

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold text-gray-900">Manage email preferences</h1>
        <p className="mt-2 text-sm text-gray-600">
          Use this page to confirm you want to stop receiving campaign emails.
        </p>

        {done ? (
          <div className="mt-6 rounded-md bg-green-50 p-4 text-sm text-green-800">
            <p className="font-medium">You have been unsubscribed.</p>
            <p className="mt-2">It can take a few minutes for all mailings to stop.</p>
          </div>
        ) : null}

        {!done && !hasToken ? (
          <div className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Invalid or expired unsubscribe link.</p>
            <p className="mt-2">Please reach out to support if you continue receiving emails.</p>
          </div>
        ) : null}

        {!done && hasToken ? (
          <form action="/api/unsubscribe" method="POST" className="mt-6 space-y-4">
            {error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error === "invalid" ? "We could not verify this unsubscribe request." : "Something went wrong. Please try again."}
              </div>
            ) : null}
            <input type="hidden" name="id" value={buyerId} />
            <input type="hidden" name="e" value={email} />
            <input type="hidden" name="t" value={timestamp} />
            <input type="hidden" name="s" value={signature} />
            <p className="text-sm text-gray-700">
              We received a request to unsubscribe {email ? <span className="font-medium">{email}</span> : "this contact"} from
              future campaign emails.
            </p>
            <p className="text-sm text-gray-600">Click confirm to finish unsubscribing.</p>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Confirm unsubscribe
              </button>
              <Link href="/" className="text-sm text-gray-600 underline">
                Stay subscribed
              </Link>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}
