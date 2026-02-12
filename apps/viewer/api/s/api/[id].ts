import type { VercelRequest, VercelResponse } from '@vercel/node'
import Redis from 'ioredis'

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

function getShareId(req: VercelRequest): string | null {
  const id = req.query.id
  const value = Array.isArray(id) ? id[0] : id
  if (!value || typeof value !== 'string') return null
  return /^[a-zA-Z0-9_-]+$/.test(value) ? value : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = getShareId(req)
  if (!id) return res.status(400).json({ error: 'Invalid share id' })
  try {
    const redis = getRedis()

    if (req.method === 'GET') {
      const raw = await redis.get(`share:${id}`)
      if (!raw) return res.status(404).json({ error: 'Session not found' })
      return res.status(200).json(JSON.parse(raw))
    }

    if (req.method === 'PUT') {
      const existingRaw = await redis.get(`share:${id}`)
      if (!existingRaw) return res.status(404).json({ error: 'Session not found' })

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

      await redis.set(`share:${id}`, JSON.stringify(parsed))
      return res.status(200).json({ id, ok: true })
    }

    if (req.method === 'DELETE') {
      const existingRaw = await redis.get(`share:${id}`)
      if (!existingRaw) return res.status(404).json({ error: 'Session not found' })
      await redis.del(`share:${id}`)
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, PUT, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to access shared session',
    })
  }
}
