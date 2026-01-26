import { runtimeEnv } from './env'

export type ProviderId = 'groq' | 'openrouter'

export interface ModelPreset {
  provider: ProviderId
  model: string
  label?: string
}

export const MODEL_PRESETS: Record<string, ModelPreset> = {
  gpt20b: { provider: 'groq', model: 'openai/gpt-oss-20b' },
  gpt120b: { provider: 'groq', model: 'openai/gpt-oss-120b' },
  qwen: { provider: 'groq', model: 'qwen/qwen3-32b' },
  kimi: { provider: 'groq', model: 'moonshotai/kimi-k2-instruct-0905' },
  sonnet45: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' },
  gemini3flashpreview: { provider: 'openrouter', model: 'google/gemini-3-flash-preview' },
  grokcodefast1: { provider: 'openrouter', model: 'x-ai/grok-code-fast-1' },
}

export const DEFAULT_MODEL =
  runtimeEnv.MODEL_ID ?? runtimeEnv.GROQ_MODEL ?? MODEL_PRESETS.kimi.model

const PROVIDERS = new Set<ProviderId>(['groq', 'openrouter'])

export const resolveModelSelection = (rawModel: string): ModelPreset => {
  const trimmed = rawModel.trim()
  if (!trimmed) {
    return { provider: 'groq', model: DEFAULT_MODEL }
  }

  const separatorIndex = trimmed.indexOf(':')
  if (separatorIndex > 0) {
    const provider = trimmed.slice(0, separatorIndex) as ProviderId
    const model = trimmed.slice(separatorIndex + 1)
    if (PROVIDERS.has(provider) && model) {
      return { provider, model }
    }
  }

  const preset = MODEL_PRESETS[trimmed]
  if (preset) {
    return preset
  }

  return { provider: 'groq', model: trimmed }
}
