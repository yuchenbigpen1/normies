import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'
import { randomUUID } from 'node:crypto'

const MAX_SESSION_BYTES = 20 * 1024 * 1024

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
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
  await kv.set(`share:${id}`, parsed)

  const host = req.headers.host
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const origin = `${protocol}://${host}`
  return res.status(201).json({ id, url: `${origin}/s/${id}` })
}
