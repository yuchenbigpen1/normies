import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

const MAX_SESSION_BYTES = 20 * 1024 * 1024

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
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

  if (req.method === 'GET') {
    const data = await kv.get(`share:${id}`)
    if (!data) return res.status(404).json({ error: 'Session not found' })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const existing = await kv.get(`share:${id}`)
    if (!existing) return res.status(404).json({ error: 'Session not found' })

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

    await kv.set(`share:${id}`, parsed)
    return res.status(200).json({ id, ok: true })
  }

  if (req.method === 'DELETE') {
    const existing = await kv.get(`share:${id}`)
    if (!existing) return res.status(404).json({ error: 'Session not found' })
    await kv.del(`share:${id}`)
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
