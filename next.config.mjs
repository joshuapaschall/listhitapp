import path from "path"
import ffmpegStatic from "ffmpeg-static"

const resolvedFfmpegPath = ffmpegStatic ? path.resolve(ffmpegStatic) : null
const ffmpegBinary = resolvedFfmpegPath
  ? path.relative(process.cwd(), resolvedFfmpegPath).replace(/\\/g, "/")
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
    FFMPEG_PATH: resolvedFfmpegPath || "",
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
