import { json } from '@sveltejs/kit'
import { listOpenRouterModels } from '$lib/server/llm/openrouter'

export const GET = async () => {
  try {
    const models = await listOpenRouterModels()
    return json({ models })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load models.'
    const status = message.toLowerCase().includes('api_key') ? 503 : 502
    return json({ error: message }, { status })
  }
}
