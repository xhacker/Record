# the record

A focused, offline-first note taking web app with a sidebar of notes and a centered editor.

## Visual Style
A warm, modern writing space with Space Grotesk + Fraunces typography, soft gradients, and a subtle glow.

## Features
- Left sidebar with notes (sorted by most recently updated)
- Add/delete notes with confirmation
- Centered editor with title + content fields
- Autosaves to localStorage after a brief pause
- Slash commands: type `/` with a prompt inside the note and press Cmd+Enter (Ctrl+Enter) to replace the command inline using paragraph context (UI default model is `kimi`)

## Quick start
1. Install dependencies: `npm install`
2. Run the dev server: `npm run dev`
3. Add env vars by copying `.env.example` to `.env.local` and filling in keys

## Project structure
- `src/routes/+page.svelte` — multi-note UI, sidebar, and autosave logic
- `src/app.css` — visual system and layout
- `AGENTS.md` — agent workflow rules

## Development notes
- Data lives in localStorage under the key `the-record-notes` as an array of notes:
  - `id`, `title`, `content`, `updatedAt`

## Server/LLM notes
- SvelteKit server routes can handle LLM proxying, streaming, auth, and basic RAG.
- Heavy/long-running jobs, GPU workloads, and large vector indexing often fit better in a separate worker/service.
- Hosting limits (timeouts, memory, edge/runtime constraints) are the main practical caps, not SvelteKit itself.
- API routes live under `src/routes/api/*` with server helpers in `src/lib/server/llm`.
- Endpoints: `GET /health`, `GET /api/models`, `POST /api/chat`.
- Runtime keys: `GROQ_API_KEY`, `OPENROUTER_API_KEY` (plus optional `OPENROUTER_BASE_URL`, `OPENROUTER_APP_URL`, `OPENROUTER_APP_TITLE`).
- Model overrides: `MODEL_ID` or `GROQ_MODEL` (defaults to `kimi` preset).

## Hosting (Railway)
- Use the SvelteKit Node adapter and a `start` script like `node build/index.js` for Railway deployments.
- Runtime secrets should be read via `$env/dynamic/private` (server-only).
- If we ever write data to disk, use Railway volumes and mount under `/app/...` to persist.
- For durable data, prefer a database + object storage; treat volumes as local cache or index storage.
