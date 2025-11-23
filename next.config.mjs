import path from "path"
import ffmpegPath from "ffmpeg-static"

const ffmpegBinary = ffmpegPath
  ? path.relative(process.cwd(), ffmpegPath).replace(/\\/g, "/")
  : null

const ffmpegIncludes = ffmpegBinary
  ? [ffmpegBinary.startsWith(".") ? ffmpegBinary : `./${ffmpegBinary}`]
  : []

async function rewrites() {
  return [
    { source: "/m/:id", destination: "/api/m/:id" },
  ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    FFMPEG_PATH: ffmpegPath || "",
  },
  images: {
    unoptimized: true,
  },
  experimental: ffmpegIncludes.length
    ? {
        outputFileTracingIncludes: {
          "app/api/media/convert/route.ts": ffmpegIncludes,
          "app/api/webhooks/telnyx-incoming-sms/route.ts": ffmpegIncludes,
        },
      }
    : {},
  rewrites,
}

export default nextConfig
