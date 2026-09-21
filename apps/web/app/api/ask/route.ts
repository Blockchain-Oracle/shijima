import { askAllowed, createAskRequest, ownsDesk } from '@desk/db'
import { errorText } from '@desk/shared'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

/**
 * A message to the desk. The web never calls the model: it writes the message as a row and the worker, which
 * holds the SERV key, answers it. The browser then polls GET /api/ask/[id].
 *
 * Signed out, nothing is written and no model is called. A desk id is honoured only for its owner. A test read
 * from the studio carries the draft settings instead of a desk, since the desk does not exist yet.
 */
export async function POST(request: Request) {
  const address = await signedInAddress()
  if (!address) return Response.json({ error: 'Sign in to talk to your desk.' }, { status: 401 })

  let body: { question?: unknown; deskId?: unknown; kind?: unknown; payload?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'That message could not be read.' }, { status: 400 })
  }
  const kind = body.kind === 'readback' ? 'readback' : 'ask'
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const deskId = typeof body.deskId === 'string' && body.deskId !== '' ? body.deskId : null
  if (kind === 'ask' && (question.length === 0 || question.length > 1000)) {
    return Response.json({ error: 'Write between 1 and 1,000 characters.' }, { status: 400 })
  }
  const payload =
    kind === 'readback' && body.payload && typeof body.payload === 'object'
      ? (body.payload as Record<string, unknown>)
      : undefined
  if (kind === 'readback' && (!payload || deskId)) {
    return Response.json({ error: 'A test read needs the draft settings.' }, { status: 400 })
  }

  try {
    if (deskId && !(await ownsDesk(db(), deskId, address))) {
      return Response.json({ error: 'That is not your desk.' }, { status: 403 })
    }
    const allowed = await askAllowed(db(), address)
    if (!allowed.ok) {
      return Response.json(
        {
          error:
            allowed.reason === 'minute'
              ? 'That is a lot of messages at once. Give it a minute.'
              : 'That is today’s allowance of messages. The desk keeps checking as usual.',
        },
        { status: 429 },
      )
    }
    const id = await createAskRequest(db(), {
      ownerAddress: address,
      deskId,
      kind,
      via: 'web',
      question: kind === 'readback' ? 'Read my settings back to me.' : question,
      ...(payload ? { payload } : {}),
    })
    return Response.json({ id }, { status: 202 })
  } catch (e) {
    console.error(`[ask] ${errorText(e)}`)
    return Response.json({ error: 'The message was not sent. Try again.' }, { status: 500 })
  }
}
