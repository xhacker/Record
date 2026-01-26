import { Groq } from 'groq-sdk'
import { runtimeEnv } from './env'

let groqClient: Groq | null = null

export function getGroqClient() {
  if (!runtimeEnv.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  if (!groqClient) {
    groqClient = new Groq({ apiKey: runtimeEnv.GROQ_API_KEY })
  }

  return groqClient
}
