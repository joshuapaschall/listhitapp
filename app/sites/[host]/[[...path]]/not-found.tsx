export default function SiteNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7f9",
        fontFamily: "'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
        color: "#0f1b29",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-.02em" }}>404</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>Site not found</h1>
        <p style={{ color: "#5a6675", fontSize: 15, lineHeight: 1.55, marginTop: 8 }}>
          This address isn&apos;t connected to a published site. If you just set it up, give
          DNS a few minutes and try again.
        </p>
      </div>
    </div>
  )
}
