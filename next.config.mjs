// Content-Security-Policy in REPORT-ONLY mode — it observes and reports
// violations without blocking, so it cannot break anything yet. The allowlist
// covers every third party the app actually uses (Mapbox, Supabase, Telnyx,
// Google Fonts, Unsplash, owner ad tags, YouTube embeds).
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net https://api.mapbox.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.mapbox.com https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://maps.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.telnyx.com wss://*.telnyx.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://td.doubleclick.net",
  "media-src 'self' blob: https://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp-report",
].join("; ")

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=(self) is REQUIRED for Telnyx calling — do not remove.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=()" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = config.resolve.alias || {}
    config.resolve.alias["@templatical/media-library"] = false
    return config
  },
  experimental: {
    outputFileTracingIncludes: {
      // Ensure ffmpeg binary is bundled for any route that uses it
      "app/api/media/convert/route.ts": ["./node_modules/ffmpeg-static/ffmpeg"],
      "app/api/webhooks/telnyx-incoming-sms/route.ts": [
        "./node_modules/ffmpeg-static/ffmpeg",
      ],
    },
  },
}

export default nextConfig
