/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
