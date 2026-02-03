import { json } from '@sveltejs/kit'
import { z } from 'zod'
import { resolveModelSelection } from '$lib/server/llm/models'
import { createOpenRouterChatCompletion } from '$lib/server/llm/openrouter'
import { getGroqClient } from '$lib/server/llm/groq'

// Tool definitions for agent mode
const agentTools = [
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description:
        "List all notes and transcripts in the user's repository. Returns file paths and types (note or transcript).",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description:
        'Read the content of a specific note or transcript. Use list_files first to find available files.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'The file path to read (e.g., "notes/my-note.md" or "transcripts/2026-02-03T13:00:00-0800.md")',
          },
        },
        required: ['path'],
      },
    },
  },
]

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })
    )
    .optional(),
  tool_call_id: z.string().optional(),
})

const chatRequestSchema = z.object({
  // Either prompt (simple) or messages (for tool continuation)
  prompt: z.string().optional(),
  messages: z.array(messageSchema).optional(),
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
  useTools: z.boolean().optional().default(false),
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
    messages: inputMessages,
    model,
    temperature,
    max_completion_tokens,
    top_p,
    stream,
    images,
    useTools,
  } = parseResult.data

  // Must have either prompt or messages
  if (!prompt && (!inputMessages || inputMessages.length === 0)) {
    return json(
      { error: 'Either prompt or messages is required.' },
      { status: 400 }
    )
  }

  const resolved = resolveModelSelection(model)
  const attachments = images ?? []

  if (stream) {
    return json({ error: 'Streaming is not enabled yet.' }, { status: 400 })
  }

  try {
    // OpenRouter path (no tool support)
    if (resolved.provider === 'openrouter') {
      if (inputMessages) {
        return json(
          { error: 'OpenRouter does not support message continuation.' },
          { status: 400 }
        )
      }

      const completion = await createOpenRouterChatCompletion({
        prompt: prompt!,
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

    // Build messages array
    const messages = inputMessages
      ? inputMessages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
          ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        }))
      : [{ role: 'user' as const, content: prompt! }]

    const completion = await client.chat.completions.create({
      messages,
      model: resolved.model,
      temperature,
      max_completion_tokens,
      top_p,
      stream: false,
      ...(useTools ? { tools: agentTools, tool_choice: 'auto' } : {}),
    })

    const choice = completion.choices?.[0]
    const message = choice?.message

    if (!message) {
      return json({ error: 'No response from model.' }, { status: 502 })
    }

    // If there are tool calls, return them to the client
    if (message.tool_calls && message.tool_calls.length > 0) {
      return json({
        id: completion.id,
        model: `groq:${completion.model ?? resolved.model}`,
        tool_calls: message.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        // Include assistant message content if any
        assistant_content: message.content ?? '',
        usage: completion.usage ?? null,
      })
    }

    // No tool calls, return final content
    return json({
      id: completion.id,
      model: `groq:${completion.model ?? resolved.model}`,
      content: message.content ?? '',
      usage: completion.usage ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create completion.'
    const status = message.toLowerCase().includes('api_key') ? 503 : 502
    return json({ error: message }, { status })
  }
}
