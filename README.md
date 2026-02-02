# the record

A note-taking app with draggable windows on a canvas. Notes are stored as markdown in a GitHub repo you control.

## Quick Start

```bash
npm install
npm run dev
```

## Current State

**Onboarding**: GitHub PAT input (MVP)
**Storage**: GitHub read + single-note write-back (on blur/Cmd+S) + new note creation, localStorage for auth + window states
- `the-record-auth` — GitHub PAT (MVP)
- `the-record-states` — window positions, sizes, visibility

**Grid**: 40px snap for all window positions and sizes

**Stack**: SvelteKit, Svelte 5

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                │
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │  Notes UI    │────▶│              │◀────│  Agent Loop              │ │
│  │              │◀────│  IndexedDB   │────▶│                          │ │
│  │  - Canvas    │     │  (cache)     │     │  Tools:                  │ │
│  │  - Windows   │     │              │     │  - list_files            │ │
│  │  - Sidebar   │     └──────┬───────┘     │  - read_file             │ │
│  └──────────────┘            │             │  - write_file            │ │
│                              │ write-      │  - search_notes          │ │
│         │                    │ through     │  - get_canvas_state      │ │
│         │ User's OAuth       │             │  - open_window           │ │
│         │ token              ▼             │  - close_window          │ │
│         │            ┌──────────────┐      │  - move_window           │ │
│         └───────────▶│  GitHub API  │◀─────│  - resize_window         │ │
│                      └──────────────┘      └──────────────────────────┘ │
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

### Data Flow

- **Reads**: IndexedDB (fast, local)
- **Writes**: IndexedDB → GitHub API (write-through)
- UI and Agent share the same cache

### Why GitHub Storage

- User owns their data (it's their repo)
- Works with Obsidian, VSCode, any editor
- No server storage needed (privacy)
- Offline support via IndexedDB

### Repo Structure

```
notes/
  meeting-notes.md
  ideas.md
.record/
  states.json
```

### GitHub API

```
GET  /repos/{owner}/{repo}/git/trees/{branch}?recursive=1  # full tree
GET  /repos/{owner}/{repo}/contents/{path}                  # read file
PUT  /repos/{owner}/{repo}/contents/{path}                  # write file
```

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

## Implementation Plan

1. Onboarding page with GitHub OAuth (PAT input for MVP) — done
2. GitHub API service — in progress (read + single-note write-back + new note creation)
2.1 Next steps
   - Wire GitHub for rename
3. Agent tools that call GitHub API directly

### After MVP
1. Actual GitHub OAuth
2. IndexedDB cache with write-through
3. Sync status indicator
4. Agent tools that read from IndexedDB
