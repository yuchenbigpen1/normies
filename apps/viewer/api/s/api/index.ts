import type { VercelRequest, VercelResponse } from '@vercel/node'
import Redis from 'ioredis'
import { randomUUID } from 'node:crypto'

const MAX_SESSION_BYTES = 20 * 1024 * 1024

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
}

let redis: Redis | null = null

function getRedis() {
  if (!process.env.REDIS_URL) {
    throw new Error('Missing REDIS_URL')
  }
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true })
  }
  return redis
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawBody =
    typeof req.body === 'string'
      ? req.body
      : req.body != null
        ? JSON.stringify(req.body)
        : ''

  if (!rawBody) return res.status(400).json({ error: 'Missing body' })
  if (rawBody.length > MAX_SESSION_BYTES) {
    return res.status(413).json({ error: 'Session file is too large to share' })
  }

  let parsed: unknown
  try {
    parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const id = randomUUID().replace(/-/g, '').slice(0, 16)
  try {
    const redis = getRedis()
    await redis.set(`share:${id}`, JSON.stringify(parsed))

    const host = req.headers.host
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const origin = `${protocol}://${host}`
    return res.status(201).json({ id, url: `${origin}/s/${id}` })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to save shared session',
    })
  }
}
