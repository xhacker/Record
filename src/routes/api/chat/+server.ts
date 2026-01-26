import { json } from '@sveltejs/kit'
import { z } from 'zod'
import { resolveModelSelection } from '$lib/server/llm/models'
import { createOpenRouterChatCompletion } from '$lib/server/llm/openrouter'
import { getGroqClient } from '$lib/server/llm/groq'

const chatRequestSchema = z.object({
  prompt: z.string().min(1),
  images: z
    .array(
      z.object({
        filename: z.string().optional(),
        dataUrl: z.string().min(1),
        mime: z.string().optional(),
        size: z.number().int().positive().optional(),
      })
    )
    .optional()
    .default([]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional().default(0.6),
  max_completion_tokens: z.number().int().positive().optional().default(4096),
  top_p: z.number().min(0).max(1).optional().default(1),
  stream: z.boolean().optional().default(false),
})

export const POST = async ({ request }) => {
  const body = await request.json().catch(() => null)
  const parseResult = chatRequestSchema.safeParse(body)

  if (!parseResult.success) {
    return json(
      { error: 'Invalid request body', issues: parseResult.error.issues },
      { status: 400 }
    )
  }

  const {
    prompt,
    model,
    temperature,
    max_completion_tokens,
    top_p,
    stream,
    images,
  } = parseResult.data
  const resolved = resolveModelSelection(model)
  const attachments = images ?? []

  if (stream) {
    return json({ error: 'Streaming is not enabled yet.' }, { status: 400 })
  }

  try {
    if (resolved.provider === 'openrouter') {
      const completion = await createOpenRouterChatCompletion({
        prompt,
        images: attachments,
        model: resolved.model,
        temperature,
        max_completion_tokens,
        top_p,
      })

      return json({
        id: completion.id,
        model: `openrouter:${completion.model ?? resolved.model}`,
        content: completion.content,
        usage: completion.usage ?? null,
      })
    }

    if (attachments.length > 0) {
      return json(
        {
          error:
            'Selected model does not support image inputs. Choose an OpenRouter model.',
        },
        { status: 400 }
      )
    }

    const client = getGroqClient()
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: resolved.model,
      temperature,
      max_completion_tokens,
      top_p,
      stream: false,
    })

    const content = completion.choices?.[0]?.message?.content ?? ''

    return json({
      id: completion.id,
      model: `groq:${completion.model ?? resolved.model}`,
      content,
      usage: completion.usage ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create completion.'
    const status = message.toLowerCase().includes('api_key') ? 503 : 502
    return json({ error: message }, { status })
  }
}
