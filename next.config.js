/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent this app from being embedded in an iframe (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing a response away from its declared content-type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send full referrer to same origin; abbreviated to origin for cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Enforce HTTPS for 1 year, including subdomains
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Lock down browser features this internal tool never uses
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Enable DNS prefetch for performance (safe for an internal tool)
  { key: "X-DNS-Prefetch-Control", value: "on" },
]

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "public.blob.vercel-storage.com",
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@neondatabase/serverless"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
