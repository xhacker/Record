import { runtimeEnv } from './env'

export interface OpenRouterChatRequest {
  prompt: string
  images?: Array<{
    dataUrl: string
    filename?: string
    mime?: string
    size?: number
  }>
  model: string
  temperature: number
  max_completion_tokens: number
  top_p: number
}

export interface OpenRouterChatResponse {
  id?: string
  model?: string
  content: string
  usage?: unknown
}

export interface OpenRouterModelSummary {
  id: string
  name?: string
  description?: string
  context_length?: number
  pricing?: unknown
  top_provider?: unknown
  architecture?: unknown
  [key: string]: unknown
}

const OPENROUTER_BASE_URL =
  runtimeEnv.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'

const buildHeaders = () => ({
  Authorization: `Bearer ${runtimeEnv.OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  ...(runtimeEnv.OPENROUTER_APP_URL
    ? { 'HTTP-Referer': runtimeEnv.OPENROUTER_APP_URL }
    : {}),
  ...(runtimeEnv.OPENROUTER_APP_TITLE
    ? { 'X-Title': runtimeEnv.OPENROUTER_APP_TITLE }
    : {}),
})

export async function createOpenRouterChatCompletion(
  request: OpenRouterChatRequest
): Promise<OpenRouterChatResponse> {
  if (!runtimeEnv.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: request.model,
      messages: [
        {
          role: 'user',
          content:
            (request.images ?? []).length > 0
              ? [
                  { type: 'text', text: request.prompt },
                  ...(request.images ?? []).map(image => ({
                    type: 'image_url',
                    image_url: { url: image.dataUrl },
                  })),
                ]
              : request.prompt,
        },
      ],
      temperature: request.temperature,
      max_tokens: request.max_completion_tokens,
      top_p: request.top_p,
      stream: false,
    }),
  })

  if (!response.ok) {
    let details = 'OpenRouter request failed'
    try {
      const errorBody = (await response.json()) as {
        error?: { message?: string } | string
        message?: string
      }
      details =
        errorBody?.error && typeof errorBody.error === 'object'
          ? errorBody.error.message ?? details
          : typeof errorBody?.error === 'string'
            ? errorBody.error
            : errorBody?.message ?? JSON.stringify(errorBody)
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(details)
  }

  const data = (await response.json()) as {
    id?: string
    model?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: unknown
  }

  return {
    id: data.id,
    model: data.model ?? request.model,
    content: data.choices?.[0]?.message?.content ?? '',
    usage: data.usage ?? null,
  }
}

export async function listOpenRouterModels(): Promise<
  OpenRouterModelSummary[]
> {
  if (!runtimeEnv.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    let details = 'OpenRouter request failed'
    try {
      const errorBody = (await response.json()) as {
        error?: { message?: string } | string
        message?: string
      }
      details =
        errorBody?.error && typeof errorBody.error === 'object'
          ? errorBody.error.message ?? details
          : typeof errorBody?.error === 'string'
            ? errorBody.error
            : errorBody?.message ?? JSON.stringify(errorBody)
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(details)
  }

  const data = (await response.json()) as { data?: OpenRouterModelSummary[] }
  return Array.isArray(data.data) ? data.data : []
}
