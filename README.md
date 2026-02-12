# the record

A note-taking app with draggable windows on a canvas. Notes are stored as markdown in a GitHub repo you control.

## Quick Start

```bash
npm install
npm run dev
```

## Required Environment

Copy `.env.example` and set values in `.env.local`:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_REDIRECT_URI` (optional; defaults to `/auth/github/callback`)
- `SESSION_SECRET` (min 32 chars)
- `SESSION_TTL_DAYS` (optional, defaults to `30`)
- Existing LLM env vars used by `/api/chat` and `/api/transcribe`

## Current State

**Auth**
- GitHub App OAuth (no PAT fallback)
- Encrypted `HttpOnly` cookie session (`record_auth_session`)
- Repo selected once during sign-in (`/auth/select-repo`)

**Storage**
- GitHub read + write + create + rename + delete
- Notes loaded through server APIs backed by GitHub App installation tokens
- Local storage only for window/canvas state (`the-record-states`)

**Editor**
- Milkdown rich-text editing for notes and transcripts
- Markdown is canonical document state
- Transcript frontmatter is hidden in editor display and preserved on save

**AI**
- Ask panel with agent tools (multi-round tool calling)
- Tool results stored as `tool:` code blocks in transcript markdown

**Stack**
- SvelteKit 2 + Svelte 5

---

## Architecture

### Current (Implemented)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                │
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │  Notes UI    │────▶│              │◀────│  Agent Loop              │ │
│  │              │◀────│  Svelte      │────▶│                          │ │
│  │  - Canvas    │     │  state       │     │  Tools:                  │ │
│  │  - Windows   │     │  (in-memory) │     │  - list_files            │ │
│  │  - Sidebar   │     └──────┬───────┘     │  - read_file             │ │
│  │  - Milkdown  │            │             │  - write_file            │ │
│  └──────────────┘            │             │  - search_notes          │ │
│                              │             │  - get_canvas_state      │ │
│                              ▼             │  - open_window           │ │
│                    ┌──────────────────┐    │  - close_window          │ │
│                    │  SvelteKit APIs  │    │  - move_window           │ │
│                    │  (/api/repo/*)   │    │  - resize_window         │ │
│                    └────────┬─────────┘    └──────────────────────────┘ │
│                             │                                           │
│                             ▼                                           │
│                    ┌──────────────────┐                                 │
│                    │ GitHub API       │                                 │
│                    │ (App installation│                                 │
│                    │  token, server)  │                                 │
│                    └──────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               │ LLM API (proxied to protect key)
                               ▼
                ┌──────────────────┐     ┌──────────────────┐
                │  Backend         │────▶│  LLM API         │
                │  /api/chat       │     │  (any provider)  │
                └──────────────────┘     └──────────────────┘
```

**Data Flow**
- **Auth**: `/auth/github/start` -> `/auth/github/callback` -> `/auth/select-repo`
- **Reads**: Browser -> `/api/repo/notes` -> GitHub API
- **Writes**: Browser -> `/api/repo/file` -> GitHub API
- UI and Agent share the same in-memory note state in browser

### Long-Term Target (Ideal)

- IndexedDB local cache with write-through sync to GitHub
- Sync status indicator
- Agent tools reading from local cache first

### Why GitHub Storage

- User owns their data (their repo)
- Works with Obsidian, VSCode, and other markdown tools
- No app database required for notes
- Markdown remains canonical storage format

### Notes Storage Repo Structure

```
meeting-notes.md
ideas.md
transcripts/
  2026-02-03T13:00:00-0800.md
.record/
  states.json
```

### Transcript Format

Transcripts are stored as markdown files with frontmatter.
Each user turn uses a bubble HTML block, optional tool-result code fences, then assistant text.

```
---
type: transcript
thread_id: 2026-02-03T13:00:00-0800
---

<div class="bubble user">Your question here.</div>

```tool:list_files
{
  "files": []
}
```

Assistant response here.
```

### GitHub API Operations Used

```
GET    /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
GET    /repos/{owner}/{repo}/git/blobs/{sha}
GET    /repos/{owner}/{repo}/contents/{path}
PUT    /repos/{owner}/{repo}/contents/{path}
DELETE /repos/{owner}/{repo}/contents/{path}
```

---

## App Routes

### Auth Routes

- `POST /auth/github/start`
- `GET /auth/github/callback`
- `GET /auth/select-repo`
- `POST /auth/select-repo` (select one repository)
- `POST /auth/signout`

### Repo API Routes (session required)

- `GET /api/repo/notes`
- `GET /api/repo/file?path=...`
- `PUT /api/repo/file`
- `DELETE /api/repo/file`
- `GET /api/repo/files`
- `GET /api/repo/search?query=...`

---

## Agent Tools

**Files**
- `list_files()` — list notes in repo
- `read_file(path)` — get note content
- `write_file(path, content)` — create/update note
- `search_notes(query)` — find notes by content

**Canvas**
- `get_canvas_state()` — returns `{ canvasSize, openWindows }`

**Windows**
- `open_window(noteId, { x?, y?, width?, height? })`
- `close_window(noteId)`
- `move_window(noteId, x, y)`
- `resize_window(noteId, width, height)`

---

## Implementation Status

1. GitHub App OAuth + repo selection + encrypted session cookie — done
2. Server-side GitHub App installation-token API layer — done
3. Agent file tools routed through authenticated `/api/repo/*` APIs — done

### Next

1. IndexedDB cache with write-through
2. Sync status indicator
3. Agent tools that read from IndexedDB
