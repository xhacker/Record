import { z } from 'zod'
import { env as privateEnv } from '$env/dynamic/private'

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const stringOptional = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional()
)

const urlOptional = z.preprocess(emptyToUndefined, z.string().url().optional())

const envSchema = z.object({
  GROQ_API_KEY: stringOptional,
  OPENROUTER_API_KEY: stringOptional,
  OPENROUTER_BASE_URL: urlOptional,
  OPENROUTER_APP_URL: urlOptional,
  OPENROUTER_APP_TITLE: stringOptional,
  MODEL_ID: stringOptional,
  GROQ_MODEL: stringOptional,
})

const parsed = envSchema.safeParse(privateEnv)

if (!parsed.success) {
  throw new Error('Invalid server environment configuration')
}

export const runtimeEnv = parsed.data
