import { z } from 'zod'
import { env as privateEnv } from '$env/dynamic/private'

const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().url().optional(),
  OPENROUTER_APP_URL: z.string().url().optional(),
  OPENROUTER_APP_TITLE: z.string().min(1).optional(),
  MODEL_ID: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),
})

const parsed = envSchema.safeParse(privateEnv)

if (!parsed.success) {
  throw new Error('Invalid server environment configuration')
}

export const runtimeEnv = parsed.data
