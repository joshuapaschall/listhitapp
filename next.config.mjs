/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
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
