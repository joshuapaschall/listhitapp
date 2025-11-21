import path from "path"
import ffmpegPath from "ffmpeg-static"

const ffmpegBinary = ffmpegPath
  ? path.relative(process.cwd(), ffmpegPath).replace(/\\/g, "/")
  : null

const ffmpegIncludes = ffmpegBinary
  ? [ffmpegBinary.startsWith(".") ? ffmpegBinary : `./${ffmpegBinary}`]
  : []

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
          "/api/**": ffmpegIncludes,
        },
      }
    : {},
}

export default nextConfig
