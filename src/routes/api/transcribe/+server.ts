import { json } from '@sveltejs/kit'
import { getGroqClient } from '$lib/server/llm/groq'

const WHISPER_MODEL = 'whisper-large-v3'

export const POST = async ({ request }) => {
  const contentType = request.headers.get('content-type') || ''

  if (!contentType.includes('multipart/form-data')) {
    return json(
      { error: 'Content-Type must be multipart/form-data' },
      { status: 400 }
    )
  }

  try {
    const formData = await request.formData()
    const audioFile = formData.get('file')

    if (!audioFile || !(audioFile instanceof File)) {
      return json({ error: 'Missing audio file' }, { status: 400 })
    }

    // Check file size (25MB limit for free tier)
    if (audioFile.size > 25 * 1024 * 1024) {
      return json(
        { error: 'Audio file exceeds 25MB limit' },
        { status: 400 }
      )
    }

    const client = getGroqClient()

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: WHISPER_MODEL,
      response_format: 'text',
      temperature: 0,
    })

    // response_format: 'text' returns the text directly as a string
    const text = typeof transcription === 'string'
      ? transcription
      : (transcription as { text?: string }).text ?? ''

    return json({ text: text.trim() })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Transcription failed.'
    const status = message.toLowerCase().includes('api_key') ? 503 : 502
    return json({ error: message }, { status })
  }
}
