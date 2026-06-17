import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const redis = createRedis()

// 10 OCR calls per user per minute — each call hits Gemini (paid)
export const ocrRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "rl:ocr",
    })
  : null

// 30 uploads per user per hour — each call writes to Vercel Blob (paid)
export const uploadRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      analytics: true,
      prefix: "rl:upload",
    })
  : null

export function rateLimitHeaders(limit: number, remaining: number, retryAfter: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "Retry-After": String(retryAfter),
  }
}
